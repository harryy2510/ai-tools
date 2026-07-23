/**
 * S3 / S3-compatible object-store client (aws4fetch SigV4).
 * Host: `new S3Client(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { AwsClient } from 'aws4fetch'
import { isNil, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { FetchLike, ToolContext } from '../../core/types'
import { base64ToBytes, bytesToBase64, bytesToUtf8, toArrayBuffer, utf8ToBytes } from '../../shared/bytes'
import type { HttpServiceOptions } from '../../transport/http-service'
import { throwHttpStatus } from '../../transport/errors'
import type {
	AbortMultipartUploadInput,
	AbortMultipartUploadOutput,
	CompleteMultipartUploadInput,
	CompleteMultipartUploadOutput,
	CopyObjectInput,
	CopyObjectOutput,
	CreateMultipartUploadInput,
	CreateMultipartUploadOutput,
	DeleteObjectInput,
	DeleteObjectOutput,
	GetObjectInput,
	GetObjectOutput,
	HeadObjectInput,
	HeadObjectOutput,
	ListObjectsInput,
	ListObjectsOutput,
	PutObjectInput,
	PutObjectOutput,
	S3Auth,
	SignedUrlInput,
	SignedUrlOutput,
	UploadPartInput,
	UploadPartOutput
} from './contracts'
import { DEFAULT_SIGNED_URL_SECONDS, MAX_MULTIPART_PART_BYTES, MAX_OBJECT_BYTES, s3AuthSchema } from './contracts'
import { copySourceHeader, firstXmlText, listUrl, objectUrl, parseListResult, stripEtagQuotes } from './domain'

export type S3ClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class S3Client {
	readonly #auth: S3Auth
	readonly #aws: AwsClient
	readonly #fetch: FetchLike
	readonly #signal: AbortSignal | undefined

	constructor(auth: S3Auth, options: S3ClientOptions = {}) {
		const parsed = s3AuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid S3 auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#signal = options.signal
		this.#fetch = options.fetch ?? globalThis.fetch
		this.#aws = new AwsClient({
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 's3',
			retries: 0,
			...(this.#auth.session_token && { sessionToken: this.#auth.session_token })
		})
	}

	static fromContext(ctx: ToolContext): S3Client {
		const auth = requireAuth(ctx, s3AuthSchema)
		return new S3Client(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async list(input: ListObjectsInput): Promise<ListObjectsOutput> {
		const params = new URLSearchParams({ 'list-type': '2' })
		if (input.prefix) params.set('prefix', input.prefix)
		if (input.delimiter) params.set('delimiter', input.delimiter)
		if (input.cursor) params.set('continuation-token', input.cursor)
		if (input.limit !== undefined) params.set('max-keys', String(input.limit))

		const response = await this.#signedFetch(listUrl(this.#auth, params), { method: 'GET' })
		if (!response.ok) throwHttpStatus('S3 list', response.status)
		const xml = await response.text()
		const listed = parseListResult(xml)
		return {
			keys: listed.items.map((o) => o.key),
			items: listed.items,
			truncated: listed.truncated,
			...(listed.common_prefixes && listed.common_prefixes.length > 0 && { common_prefixes: listed.common_prefixes }),
			...(listed.next_cursor && { next_cursor: listed.next_cursor })
		}
	}

	async get(input: GetObjectInput): Promise<GetObjectOutput> {
		const response = await this.#signedFetch(objectUrl(this.#auth, input.key), { method: 'GET' })
		if (response.status === 404) {
			throw new ToolError('Object not found', { code: 'not_found' })
		}
		if (!response.ok) throwHttpStatus('S3 get', response.status)
		const lengthHeader = response.headers.get('content-length')
		const contentLength = isString(lengthHeader) ? Number.parseInt(lengthHeader, 10) : undefined
		if (!isNil(contentLength) && Number.isFinite(contentLength) && contentLength > MAX_OBJECT_BYTES) {
			throw new ToolError('Object exceeds 5 MiB download limit', {
				code: 'too_large',
				details: { max_bytes: MAX_OBJECT_BYTES, content_length: contentLength }
			})
		}
		const bytes = new Uint8Array(await response.arrayBuffer())
		if (bytes.byteLength > MAX_OBJECT_BYTES) {
			throw new ToolError('Object exceeds 5 MiB download limit', {
				code: 'too_large',
				details: { max_bytes: MAX_OBJECT_BYTES, content_length: bytes.byteLength }
			})
		}
		const encoding = input.encoding ?? 'base64'
		const body = encoding === 'utf8' ? bytesToUtf8(bytes) : bytesToBase64(bytes)
		const contentType = response.headers.get('content-type')
		return {
			key: input.key,
			body,
			encoding,
			...(isString(contentType) && { content_type: contentType }),
			...(isNil(contentLength) || !Number.isFinite(contentLength)
				? { content_length: bytes.byteLength }
				: { content_length: contentLength })
		}
	}

	async put(input: PutObjectInput): Promise<PutObjectOutput> {
		const encoding = input.body_encoding ?? 'utf8'
		let bodyBytes: Uint8Array
		try {
			bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		} catch (error) {
			throw new ToolError('Invalid body encoding for putObject', {
				code: 'bad_input',
				cause: error
			})
		}
		if (bodyBytes.byteLength > MAX_OBJECT_BYTES) {
			throw new ToolError('Object exceeds 5 MiB upload limit', {
				code: 'too_large',
				details: { max_bytes: MAX_OBJECT_BYTES, content_length: bodyBytes.byteLength }
			})
		}
		const headers: Record<string, string> = {}
		if (input.content_type) headers['Content-Type'] = input.content_type

		const response = await this.#signedFetch(objectUrl(this.#auth, input.key), {
			method: 'PUT',
			body: toArrayBuffer(bodyBytes),
			headers
		})
		if (!response.ok) throwHttpStatus('S3 put', response.status)
		const etag = response.headers.get('etag')
		return {
			key: input.key,
			content_length: bodyBytes.byteLength,
			...(isString(etag) && { etag: stripEtagQuotes(etag) })
		}
	}

	async delete(input: DeleteObjectInput): Promise<DeleteObjectOutput> {
		const response = await this.#signedFetch(objectUrl(this.#auth, input.key), { method: 'DELETE' })
		if (!response.ok && response.status !== 404) throwHttpStatus('S3 delete', response.status)
		return { key: input.key, deleted: true }
	}

	async head(input: HeadObjectInput): Promise<HeadObjectOutput> {
		const response = await this.#signedFetch(objectUrl(this.#auth, input.key), { method: 'HEAD' })
		if (response.status === 404) {
			return { key: input.key, exists: false }
		}
		if (!response.ok) throwHttpStatus('S3 head', response.status)
		const contentType = response.headers.get('content-type')
		const lengthHeader = response.headers.get('content-length')
		const etag = response.headers.get('etag')
		const contentLength = isString(lengthHeader) ? Number.parseInt(lengthHeader, 10) : undefined
		return {
			key: input.key,
			exists: true,
			...(isString(contentType) && { content_type: contentType }),
			...(!isNil(contentLength) && Number.isFinite(contentLength) && { content_length: contentLength }),
			...(isString(etag) && { etag: stripEtagQuotes(etag) })
		}
	}

	async copy(input: CopyObjectInput): Promise<CopyObjectOutput> {
		const response = await this.#signedFetch(objectUrl(this.#auth, input.destination_key), {
			method: 'PUT',
			headers: {
				'x-amz-copy-source': copySourceHeader(this.#auth, input.source_key, input.source_bucket)
			}
		})
		if (!response.ok) throwHttpStatus('S3 copy', response.status)
		const xml = await response.text()
		const etagRaw = firstXmlText(xml, 'ETag')
		const headerEtag = response.headers.get('etag')
		const etag = etagRaw ? stripEtagQuotes(etagRaw) : isString(headerEtag) ? stripEtagQuotes(headerEtag) : undefined
		return {
			source_key: input.source_key,
			destination_key: input.destination_key,
			...(etag && { etag })
		}
	}

	async createSignedUrl(input: SignedUrlInput): Promise<SignedUrlOutput> {
		const method = input.method ?? 'GET'
		const expiresIn = input.expires_in ?? DEFAULT_SIGNED_URL_SECONDS
		const url = objectUrl(this.#auth, input.key, `X-Amz-Expires=${expiresIn}`)
		try {
			const signed = await this.#aws.sign(url, {
				method,
				aws: { signQuery: true }
			})
			return {
				url: signed.url,
				method,
				expires_in: expiresIn
			}
		} catch (error) {
			throw new ToolError('Failed to create signed URL', {
				code: 'internal',
				cause: error
			})
		}
	}

	async createMultipartUpload(input: CreateMultipartUploadInput): Promise<CreateMultipartUploadOutput> {
		const headers: Record<string, string> = {}
		if (input.content_type) headers['Content-Type'] = input.content_type
		const response = await this.#signedFetch(objectUrl(this.#auth, input.key, 'uploads'), {
			method: 'POST',
			headers
		})
		if (!response.ok) throwHttpStatus('S3 create multipart upload', response.status)
		const xml = await response.text()
		const uploadIdRaw = firstXmlText(xml, 'UploadId')
		if (!uploadIdRaw) {
			throw new ToolError('S3 create multipart upload returned no UploadId', { code: 'upstream' })
		}
		return {
			key: input.key,
			upload_id: uploadIdRaw
		}
	}

	async uploadPart(input: UploadPartInput): Promise<UploadPartOutput> {
		const encoding = input.body_encoding ?? 'utf8'
		let bodyBytes: Uint8Array
		try {
			bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		} catch (error) {
			throw new ToolError('Invalid body encoding for uploadPart', {
				code: 'bad_input',
				cause: error
			})
		}
		if (bodyBytes.byteLength > MAX_MULTIPART_PART_BYTES) {
			throw new ToolError('Multipart part exceeds 25 MiB upload limit', {
				code: 'too_large',
				details: { max_bytes: MAX_MULTIPART_PART_BYTES, content_length: bodyBytes.byteLength }
			})
		}
		if (bodyBytes.byteLength === 0) {
			throw new ToolError('Multipart part body must not be empty', { code: 'bad_input' })
		}
		const query = new URLSearchParams({
			partNumber: String(input.part_number),
			uploadId: input.upload_id
		})
		const response = await this.#signedFetch(objectUrl(this.#auth, input.key, query.toString()), {
			method: 'PUT',
			body: toArrayBuffer(bodyBytes)
		})
		if (!response.ok) throwHttpStatus('S3 upload part', response.status)
		const etagHeader = response.headers.get('etag')
		if (!isString(etagHeader) || etagHeader.length === 0) {
			throw new ToolError('S3 upload part returned no ETag', { code: 'upstream' })
		}
		return {
			key: input.key,
			upload_id: input.upload_id,
			part_number: input.part_number,
			etag: stripEtagQuotes(etagHeader),
			content_length: bodyBytes.byteLength
		}
	}

	async completeMultipartUpload(input: CompleteMultipartUploadInput): Promise<CompleteMultipartUploadOutput> {
		const sorted = [...input.parts].sort((a, b) => a.part_number - b.part_number)
		const partsXml = sorted
			.map((part) => {
				const etag = stripEtagQuotes(part.etag)
				return `<Part><PartNumber>${part.part_number}</PartNumber><ETag>"${etag}"</ETag></Part>`
			})
			.join('')
		const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`
		const query = new URLSearchParams({ uploadId: input.upload_id })
		const response = await this.#signedFetch(objectUrl(this.#auth, input.key, query.toString()), {
			method: 'POST',
			body,
			headers: { 'Content-Type': 'application/xml' }
		})
		if (!response.ok) throwHttpStatus('S3 complete multipart upload', response.status)
		const xml = await response.text()
		const etagRaw = firstXmlText(xml, 'ETag')
		const headerEtag = response.headers.get('etag')
		const etag = etagRaw ? stripEtagQuotes(etagRaw) : isString(headerEtag) ? stripEtagQuotes(headerEtag) : undefined
		return {
			key: input.key,
			upload_id: input.upload_id,
			...(etag && { etag })
		}
	}

	async abortMultipartUpload(input: AbortMultipartUploadInput): Promise<AbortMultipartUploadOutput> {
		const query = new URLSearchParams({ uploadId: input.upload_id })
		const response = await this.#signedFetch(objectUrl(this.#auth, input.key, query.toString()), {
			method: 'DELETE'
		})
		if (!response.ok && response.status !== 404) throwHttpStatus('S3 abort multipart upload', response.status)
		return { key: input.key, upload_id: input.upload_id, aborted: true }
	}

	/** Host-facing raw download (no size cap). */
	async getBytes(key: string): Promise<Uint8Array> {
		const response = await this.#signedFetch(objectUrl(this.#auth, key), { method: 'GET' })
		if (response.status === 404) throw new ToolError('Object not found', { code: 'not_found' })
		if (!response.ok) throwHttpStatus('S3 get', response.status)
		return new Uint8Array(await response.arrayBuffer())
	}

	/** Host-facing raw upload. */
	async putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void> {
		const headers: Record<string, string> = {}
		if (isString(contentType) && contentType.length > 0) headers['Content-Type'] = contentType
		const response = await this.#signedFetch(objectUrl(this.#auth, key), {
			method: 'PUT',
			body: toArrayBuffer(bytes),
			headers
		})
		if (!response.ok) throwHttpStatus('S3 put', response.status)
	}

	async #signedFetch(url: string, init: RequestInit = {}): Promise<Response> {
		try {
			const signed = await this.#aws.sign(url, {
				...init,
				...(this.#signal && { signal: this.#signal })
			})
			return await this.#fetch(signed)
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new ToolError('S3 request was aborted', {
					code: 'timeout',
					retryable: true,
					cause: error
				})
			}
			throw new ToolError('S3 request failed', {
				code: 'upstream',
				retryable: true,
				cause: error
			})
		}
	}
}
