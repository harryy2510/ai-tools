/**
 * Supabase Storage vendor client (Storage REST `/storage/v1`).
 * Host: `new SupabaseStorageClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { base64ToBytes, encodeObjectKeyPath, toArrayBuffer, utf8ToBytes } from '../../shared/bytes'
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
	SupabaseStorageAuth
} from './contracts'
import { supabaseStorageAuthSchema } from './contracts'
import { assertSize, decodeBody } from './domain'

export type SupabaseStorageClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class SupabaseStorageClient {
	readonly #auth: SupabaseStorageAuth
	readonly #http: HttpService
	readonly #bucket: string

	constructor(auth: SupabaseStorageAuth, options: SupabaseStorageClientOptions = {}) {
		const parsed = supabaseStorageAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Supabase storage auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#bucket = encodeURIComponent(this.#auth.bucket)
		this.#http = new HttpService({
			...options,
			baseURL: `${this.#auth.url.replace(/\/+$/, '')}/storage/v1`,
			headers: {
				Authorization: `Bearer ${this.#auth.service_role_key}`,
				apikey: this.#auth.service_role_key
			},
			label: 'Supabase storage'
		})
	}

	static fromContext(ctx: ToolContext): SupabaseStorageClient {
		const auth = requireAuth(ctx, supabaseStorageAuthSchema)
		return new SupabaseStorageClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	#objectPath(key: string): string {
		return `/object/${this.#bucket}/${encodeObjectKeyPath(key)}`
	}

	async list(input: ListObjectsInput): Promise<ListObjectsOutput> {
		const prefix = input.prefix ?? ''
		const limit = input.limit ?? 100
		const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0
		if (input.cursor && !Number.isFinite(offset)) {
			throw new ToolError('Invalid list cursor', { code: 'bad_input' })
		}
		const { data } = await this.#http.post(
			`/object/list/${this.#bucket}`,
			{
				prefix,
				limit,
				offset: Number.isFinite(offset) ? offset : 0,
				delimiter: input.delimiter
			},
			{ label: 'Supabase storage list' }
		)
		if (!Array.isArray(data)) {
			throw new ToolError('Supabase list returned unexpected payload', { code: 'upstream' })
		}
		const items: Array<{ key: string; size?: number; last_modified?: string; etag?: string }> = []
		const common_prefixes: string[] = []
		for (const row of data) {
			if (!isPlainObject(row)) continue
			const name = row['name']
			if (!isString(name)) continue
			const id = row['id']
			if (id === null || id === undefined) {
				common_prefixes.push(prefix ? `${prefix}${name}` : name)
				continue
			}
			const key = prefix ? `${prefix.replace(/\/?$/, '/')}${name}` : name
			const meta = row['metadata']
			const size =
				isPlainObject(meta) && typeof meta['size'] === 'number' && Number.isFinite(meta['size'])
					? meta['size']
					: undefined
			const updated = row['updated_at']
			items.push({
				key,
				...(size !== undefined && { size }),
				...(isString(updated) ? { last_modified: updated } : {})
			})
		}
		const truncated = data.length >= limit
		const nextOffset = (Number.isFinite(offset) ? offset : 0) + data.length
		return {
			keys: items.map((i) => i.key),
			items,
			truncated,
			...(truncated ? { next_cursor: String(nextOffset) } : {}),
			...(common_prefixes.length > 0 ? { common_prefixes } : {})
		}
	}

	async get(input: GetObjectInput): Promise<GetObjectOutput> {
		const { bytes, headers } = await this.#http.bytes('GET', this.#objectPath(input.key), {
			label: 'Supabase storage get'
		})
		assertSize(bytes, 'download')
		const encoding = input.encoding ?? 'base64'
		const contentType = headers.get('content-type')
		return {
			key: input.key,
			body: decodeBody(bytes, encoding),
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
		await this.#http.post(this.#objectPath(input.key), toArrayBuffer(bodyBytes), {
			label: 'Supabase storage put',
			headers: {
				'Content-Type': input.content_type ?? 'application/octet-stream',
				'x-upsert': 'true'
			}
		})
		return { key: input.key, content_length: bodyBytes.byteLength }
	}

	async delete(input: DeleteObjectInput): Promise<DeleteObjectOutput> {
		await this.#http.query('DELETE', `/object/${this.#bucket}`, {
			label: 'Supabase storage delete',
			body: { prefixes: [input.key] },
			allowStatuses: [404]
		})
		return { key: input.key, deleted: true }
	}

	async head(input: HeadObjectInput): Promise<HeadObjectOutput> {
		const { status, data } = await this.#http.get(`/object/info/${this.#bucket}/${encodeObjectKeyPath(input.key)}`, {
			label: 'Supabase storage head',
			allowStatuses: [404]
		})
		if (status === 404) return { key: input.key, exists: false }
		if (!isPlainObject(data)) return { key: input.key, exists: true }
		const meta = data['metadata']
		const size =
			isPlainObject(meta) && typeof meta['size'] === 'number' && Number.isFinite(meta['size'])
				? meta['size']
				: undefined
		const contentType = isPlainObject(meta) && isString(meta['mimetype']) ? meta['mimetype'] : undefined
		return {
			key: input.key,
			exists: true,
			...(size !== undefined && { content_length: size }),
			...(contentType && { content_type: contentType })
		}
	}

	async copy(input: CopyObjectInput): Promise<CopyObjectOutput> {
		await this.#http.post(
			'/object/copy',
			{
				bucketId: input.source_bucket ?? this.#auth.bucket,
				sourceKey: input.source_key,
				destinationBucket: this.#auth.bucket,
				destinationKey: input.destination_key
			},
			{ label: 'Supabase storage copy' }
		)
		return {
			source_key: input.source_key,
			destination_key: input.destination_key
		}
	}

	async getBytes(key: string): Promise<Uint8Array> {
		const { bytes } = await this.#http.bytes('GET', this.#objectPath(key), {
			label: 'Supabase storage getBytes'
		})
		return bytes
	}

	async putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void> {
		await this.#http.post(this.#objectPath(key), toArrayBuffer(bytes), {
			label: 'Supabase storage putBytes',
			headers: {
				'Content-Type': contentType ?? 'application/octet-stream',
				'x-upsert': 'true'
			}
		})
	}
}
