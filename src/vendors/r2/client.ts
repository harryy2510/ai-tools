/**
 * Cloudflare R2 vendor client (Cloudflare REST API).
 * Host: `new R2Client(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import {
	base64ToBytes,
	bytesToBase64,
	bytesToUtf8,
	encodeObjectKeyPath,
	toArrayBuffer,
	utf8ToBytes
} from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	CopyObjectInput,
	CopyObjectOutput,
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
	R2Auth
} from './contracts'
import { r2AuthSchema } from './contracts'
import { assertCfEnvelope, assertSize } from './domain'

export type R2ClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class R2Client {
	readonly #auth: R2Auth
	readonly #http: HttpService

	constructor(auth: R2Auth, options: R2ClientOptions = {}) {
		const parsed = r2AuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid R2 auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.#auth.api_token}`
		}
		if (this.#auth.jurisdiction) {
			headers['cf-r2-jurisdiction'] = this.#auth.jurisdiction
		}
		this.#http = new HttpService({
			...options,
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.#auth.account_id)}/r2/buckets/${encodeURIComponent(this.#auth.bucket)}`,
			headers,
			label: 'R2 REST'
		})
	}

	static fromContext(ctx: ToolContext): R2Client {
		const auth = requireAuth(ctx, r2AuthSchema)
		return new R2Client(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	#objectPath(key: string): string {
		return `/objects/${encodeObjectKeyPath(key)}`
	}

	async list(input: ListObjectsInput): Promise<ListObjectsOutput> {
		const { data } = await this.#http.get('/objects', {
			label: 'R2 REST list',
			query: {
				prefix: input.prefix,
				delimiter: input.delimiter,
				cursor: input.cursor,
				per_page: input.limit
			}
		})
		assertCfEnvelope(data, 'list')
		if (!isPlainObject(data)) {
			throw new ToolError('R2 list returned unexpected payload', { code: 'upstream' })
		}
		const result = data['result']
		const items: Array<{ key: string; size?: number; last_modified?: string; etag?: string }> = []
		if (Array.isArray(result)) {
			for (const row of result) {
				if (!isPlainObject(row)) continue
				const key = row['key']
				if (!isString(key) || key.length === 0) continue
				const size = typeof row['size'] === 'number' && Number.isFinite(row['size']) ? row['size'] : undefined
				const last_modified = isString(row['last_modified']) ? row['last_modified'] : undefined
				const etag = isString(row['etag']) ? row['etag'] : undefined
				items.push({
					key,
					...(size !== undefined && { size }),
					...(last_modified && { last_modified }),
					...(etag && { etag })
				})
			}
		}
		const info = data['result_info']
		const truncated = isPlainObject(info) && typeof info['is_truncated'] === 'boolean' ? info['is_truncated'] : false
		const next =
			isPlainObject(info) && isString(info['cursor']) && info['cursor'].length > 0 ? info['cursor'] : undefined
		const common =
			isPlainObject(info) && Array.isArray(info['delimited']) ? info['delimited'].filter(isString) : undefined
		return {
			keys: items.map((i) => i.key),
			items,
			truncated,
			...(next && { next_cursor: next }),
			...(common && common.length > 0 ? { common_prefixes: common } : {})
		}
	}

	async get(input: GetObjectInput): Promise<GetObjectOutput> {
		const { bytes, headers } = await this.#http.bytes('GET', this.#objectPath(input.key), {
			label: 'R2 REST get'
		})
		assertSize(bytes, 'download')
		const encoding = input.encoding ?? 'base64'
		const contentType = headers.get('content-type')
		return {
			key: input.key,
			body: encoding === 'utf8' ? bytesToUtf8(bytes) : bytesToBase64(bytes),
			encoding,
			content_length: bytes.byteLength,
			...(isString(contentType) ? { content_type: contentType } : {})
		}
	}

	async put(input: PutObjectInput): Promise<PutObjectOutput> {
		const encoding = input.body_encoding ?? 'utf8'
		let bodyBytes: Uint8Array
		try {
			bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		} catch (error) {
			throw new ToolError('Invalid body encoding for putObject', { code: 'bad_input', cause: error })
		}
		assertSize(bodyBytes, 'upload')
		const { data } = await this.#http.put(this.#objectPath(input.key), toArrayBuffer(bodyBytes), {
			label: 'R2 REST put',
			headers: { 'Content-Type': input.content_type ?? 'application/octet-stream' }
		})
		assertCfEnvelope(data, 'put')
		let etag: string | undefined
		if (isPlainObject(data) && isPlainObject(data['result']) && isString(data['result']['etag'])) {
			etag = data['result']['etag']
		}
		return {
			key: input.key,
			content_length: bodyBytes.byteLength,
			...(etag && { etag })
		}
	}

	async delete(input: DeleteObjectInput): Promise<DeleteObjectOutput> {
		await this.#http.delete(this.#objectPath(input.key), {
			label: 'R2 REST delete',
			allowStatuses: [404]
		})
		return { key: input.key, deleted: true }
	}

	async head(input: HeadObjectInput): Promise<HeadObjectOutput> {
		const { data } = await this.#http.get('/objects', {
			label: 'R2 REST head',
			query: { prefix: input.key, per_page: 1 }
		})
		assertCfEnvelope(data, 'head')
		if (!isPlainObject(data) || !Array.isArray(data['result'])) {
			return { key: input.key, exists: false }
		}
		const first = data['result'][0]
		if (!isPlainObject(first) || first['key'] !== input.key) {
			return { key: input.key, exists: false }
		}
		const size = typeof first['size'] === 'number' && Number.isFinite(first['size']) ? first['size'] : undefined
		const etag = isString(first['etag']) ? first['etag'] : undefined
		const meta = first['http_metadata']
		const contentType = isPlainObject(meta) && isString(meta['contentType']) ? meta['contentType'] : undefined
		return {
			key: input.key,
			exists: true,
			...(size !== undefined && { content_length: size }),
			...(etag && { etag }),
			...(contentType && { content_type: contentType })
		}
	}

	async copy(input: CopyObjectInput): Promise<CopyObjectOutput> {
		if (input.source_bucket) {
			throw new ToolError('R2 REST copy across buckets is not supported; use S3-compatible API', {
				code: 'unsupported'
			})
		}
		const { bytes, headers } = await this.#http.bytes('GET', this.#objectPath(input.source_key), {
			label: 'R2 REST copy get'
		})
		const contentType = headers.get('content-type') ?? 'application/octet-stream'
		await this.#http.put(this.#objectPath(input.destination_key), toArrayBuffer(bytes), {
			label: 'R2 REST copy put',
			headers: { 'Content-Type': contentType }
		})
		return {
			source_key: input.source_key,
			destination_key: input.destination_key
		}
	}

	async getBytes(key: string): Promise<Uint8Array> {
		const { bytes } = await this.#http.bytes('GET', this.#objectPath(key), { label: 'R2 REST getBytes' })
		return bytes
	}

	async putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void> {
		await this.#http.put(this.#objectPath(key), toArrayBuffer(bytes), {
			label: 'R2 REST putBytes',
			headers: { 'Content-Type': contentType ?? 'application/octet-stream' }
		})
	}
}
