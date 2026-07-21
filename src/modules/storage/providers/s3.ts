import { AwsClient } from 'aws4fetch'
import { isNil, isString } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '../../../shared/bytes'
import { throwHttpStatus } from '../../../shared/rate-limit'
import { DEFAULT_SIGNED_URL_SECONDS, MAX_OBJECT_BYTES } from '../contracts'
import type {
	CopyObjectInput,
	DeleteObjectInput,
	GetObjectInput,
	HeadObjectInput,
	ListObjectsInput,
	PutObjectInput,
	SignedUrlInput,
	StorageOps
} from '../contracts'

export const s3StorageAuthSchema = z.object({
	provider: z.literal('s3'),
	accessKeyId: z.string().min(1).describe('S3 access key id'),
	secretAccessKey: z.string().min(1).describe('S3 secret access key'),
	region: z.string().min(1).describe('AWS region or R2 jurisdiction region string'),
	bucket: z.string().min(1).describe('Default bucket name'),
	endpoint: z.url().optional().describe('Optional custom endpoint for S3-compatible stores (R2 S3 API, MinIO)'),
	sessionToken: z.string().min(1).optional().describe('Optional session token for temporary credentials')
})

export type S3StorageAuth = z.infer<typeof s3StorageAuthSchema>

function objectUrl(auth: S3StorageAuth, key: string, query?: string): string {
	const encodedKey = key
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/')
	const base = auth.endpoint
		? `${auth.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(auth.bucket)}/${encodedKey}`
		: `https://${auth.bucket}.s3.${auth.region}.amazonaws.com/${encodedKey}`
	return query ? `${base}?${query}` : base
}

function listUrl(auth: S3StorageAuth, params: URLSearchParams): string {
	const base = auth.endpoint
		? `${auth.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(auth.bucket)}`
		: `https://${auth.bucket}.s3.${auth.region}.amazonaws.com`
	const qs = params.toString()
	return qs ? `${base}?${qs}` : base
}

function clientFor(auth: S3StorageAuth): AwsClient {
	return new AwsClient({
		accessKeyId: auth.accessKeyId,
		secretAccessKey: auth.secretAccessKey,
		region: auth.region,
		service: 's3',
		...(auth.sessionToken === undefined ? {} : { sessionToken: auth.sessionToken })
	})
}

async function signedFetch(auth: S3StorageAuth, url: string, init: RequestInit, ctx: ToolContext): Promise<Response> {
	const aws = clientFor(auth)
	try {
		return await aws.fetch(url, {
			...init,
			...(ctx.signal === undefined ? {} : { signal: ctx.signal })
		})
	} catch (error) {
		throw new ToolError('S3 request failed', {
			code: 'upstream',
			retryable: true,
			cause: error
		})
	}
}

function xmlTag(xml: string, tag: string): string[] {
	const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g')
	const out: string[] = []
	for (const match of xml.matchAll(re)) {
		const value = match[1]
		if (value !== undefined) out.push(value)
	}
	return out
}

function decodeXmlEntities(value: string): string {
	return value
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&apos;', "'")
		.replaceAll('&amp;', '&')
}

type ListedObject = {
	key: string
	size?: number
	last_modified?: string
	etag?: string
}

function parseListContents(xml: string): ListedObject[] {
	const re = /<Contents>([\s\S]*?)<\/Contents>/g
	const out: ListedObject[] = []
	for (const match of xml.matchAll(re)) {
		const block = match[1]
		if (block === undefined) continue
		const keyRaw = xmlTag(block, 'Key')[0]
		if (keyRaw === undefined) continue
		const key = decodeXmlEntities(keyRaw)
		const sizeRaw = xmlTag(block, 'Size')[0]
		const size = sizeRaw === undefined ? undefined : Number.parseInt(sizeRaw, 10)
		const lastModified = xmlTag(block, 'LastModified')[0]
		const etagRaw = xmlTag(block, 'ETag')[0]
		const etag =
			etagRaw === undefined ? undefined : decodeXmlEntities(etagRaw).replaceAll('"', '').replaceAll('&quot;', '')
		out.push({
			key,
			...(size !== undefined && Number.isFinite(size) ? { size } : {}),
			...(lastModified === undefined ? {} : { last_modified: lastModified }),
			...(etag === undefined || etag.length === 0 ? {} : { etag })
		})
	}
	return out
}

function copySourceHeader(auth: S3StorageAuth, sourceKey: string, sourceBucket?: string): string {
	const bucket = sourceBucket ?? auth.bucket
	const encodedKey = sourceKey
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/')
	return `/${encodeURIComponent(bucket)}/${encodedKey}`
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const bodyBuffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(bodyBuffer).set(bytes)
	return bodyBuffer
}

function readS3Auth(ctx: ToolContext): S3StorageAuth {
	const parsed = s3StorageAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('S3 storage credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

const ops: StorageOps = {
	list: async (input: ListObjectsInput, ctx) => {
		const auth = readS3Auth(ctx)
		const params = new URLSearchParams({ 'list-type': '2' })
		if (input.prefix !== undefined) params.set('prefix', input.prefix)
		if (input.delimiter !== undefined) params.set('delimiter', input.delimiter)
		if (input.cursor !== undefined) params.set('continuation-token', input.cursor)
		if (input.limit !== undefined) params.set('max-keys', String(input.limit))

		const response = await signedFetch(auth, listUrl(auth, params), { method: 'GET' }, ctx)
		if (!response.ok) throwHttpStatus('S3 list', response.status)
		const xml = await response.text()
		const items = parseListContents(xml)
		const keys = items.map((o) => o.key)
		const isTruncated = xmlTag(xml, 'IsTruncated')[0]?.toLowerCase() === 'true'
		const next = xmlTag(xml, 'NextContinuationToken')[0]
		const commonFromBlocks: string[] = []
		for (const match of xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)) {
			const block = match[1]
			if (block === undefined) continue
			const prefix = xmlTag(block, 'Prefix')[0]
			if (prefix !== undefined) commonFromBlocks.push(decodeXmlEntities(prefix))
		}
		return {
			keys,
			items,
			truncated: isTruncated,
			...(commonFromBlocks.length > 0 ? { common_prefixes: commonFromBlocks } : {}),
			...(next === undefined ? {} : { next_cursor: next })
		}
	},

	get: async (input: GetObjectInput, ctx) => {
		const auth = readS3Auth(ctx)
		const response = await signedFetch(auth, objectUrl(auth, input.key), { method: 'GET' }, ctx)
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
			...(isString(contentType) ? { content_type: contentType } : {}),
			...(isNil(contentLength) || !Number.isFinite(contentLength)
				? { content_length: bytes.byteLength }
				: { content_length: contentLength })
		}
	},

	put: async (input: PutObjectInput, ctx) => {
		const auth = readS3Auth(ctx)
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
		if (input.content_type !== undefined) headers['Content-Type'] = input.content_type

		const response = await signedFetch(
			auth,
			objectUrl(auth, input.key),
			{
				method: 'PUT',
				body: toArrayBuffer(bodyBytes),
				headers
			},
			ctx
		)
		if (!response.ok) throwHttpStatus('S3 put', response.status)
		const etag = response.headers.get('etag')
		return {
			key: input.key,
			content_length: bodyBytes.byteLength,
			...(isString(etag) ? { etag: etag.replaceAll('"', '') } : {})
		}
	},

	delete: async (input: DeleteObjectInput, ctx) => {
		const auth = readS3Auth(ctx)
		const response = await signedFetch(auth, objectUrl(auth, input.key), { method: 'DELETE' }, ctx)
		if (!response.ok && response.status !== 404) throwHttpStatus('S3 delete', response.status)
		return { key: input.key, deleted: true }
	},

	head: async (input: HeadObjectInput, ctx) => {
		const auth = readS3Auth(ctx)
		const response = await signedFetch(auth, objectUrl(auth, input.key), { method: 'HEAD' }, ctx)
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
			...(isString(contentType) ? { content_type: contentType } : {}),
			...(!isNil(contentLength) && Number.isFinite(contentLength) ? { content_length: contentLength } : {}),
			...(isString(etag) ? { etag: etag.replaceAll('"', '') } : {})
		}
	},

	copy: async (input: CopyObjectInput, ctx) => {
		const auth = readS3Auth(ctx)
		const response = await signedFetch(
			auth,
			objectUrl(auth, input.destination_key),
			{
				method: 'PUT',
				headers: {
					'x-amz-copy-source': copySourceHeader(auth, input.source_key, input.source_bucket)
				}
			},
			ctx
		)
		if (!response.ok) throwHttpStatus('S3 copy', response.status)
		const xml = await response.text()
		const etagRaw = xmlTag(xml, 'ETag')[0]
		const headerEtag = response.headers.get('etag')
		const etag =
			etagRaw !== undefined
				? decodeXmlEntities(etagRaw).replaceAll('"', '')
				: isString(headerEtag)
					? headerEtag.replaceAll('"', '')
					: undefined
		return {
			source_key: input.source_key,
			destination_key: input.destination_key,
			...(etag === undefined || etag.length === 0 ? {} : { etag })
		}
	},

	createSignedUrl: async (input: SignedUrlInput, ctx) => {
		const auth = readS3Auth(ctx)
		const method = input.method ?? 'GET'
		const expiresIn = input.expires_in ?? DEFAULT_SIGNED_URL_SECONDS
		const url = objectUrl(auth, input.key, `X-Amz-Expires=${expiresIn}`)
		const aws = clientFor(auth)
		try {
			const signed = await aws.sign(url, {
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
	},

	getBytes: async (key, ctx) => {
		const auth = readS3Auth(ctx)
		const response = await signedFetch(auth, objectUrl(auth, key), { method: 'GET' }, ctx)
		if (response.status === 404) throw new ToolError('Object not found', { code: 'not_found' })
		if (!response.ok) throwHttpStatus('S3 get', response.status)
		return new Uint8Array(await response.arrayBuffer())
	},

	putBytes: async (key, bytes, contentType, ctx) => {
		const auth = readS3Auth(ctx)
		const headers: Record<string, string> = {}
		if (isString(contentType) && contentType.length > 0) headers['Content-Type'] = contentType
		const response = await signedFetch(
			auth,
			objectUrl(auth, key),
			{ method: 'PUT', body: toArrayBuffer(bytes), headers },
			ctx
		)
		if (!response.ok) throwHttpStatus('S3 put', response.status)
	}
}

export const s3StorageProvider = defineProvider({
	id: 's3',
	title: 'S3 / S3-compatible',
	authSchema: s3StorageAuthSchema,
	ops
})
