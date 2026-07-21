import { createFetch, FetchError } from 'ofetch'
import { isPlainObject, isString } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '../../../shared/bytes'
import { throwHttpStatus, retryAfterMsFromHeader } from '../../../shared/rate-limit'
import { MAX_OBJECT_BYTES } from '../contracts'
import type {
	CopyObjectInput,
	DeleteObjectInput,
	GetObjectInput,
	HeadObjectInput,
	ListObjectsInput,
	PutObjectInput,
	StorageOps
} from '../contracts'

export const supabaseStorageAuthSchema = z.object({
	provider: z.literal('supabase'),
	url: z.url().describe('Supabase project URL, for example https://xyz.supabase.co'),
	serviceRoleKey: z.string().min(1).describe('Supabase service role key (host-only)'),
	bucket: z.string().min(1).describe('Storage bucket id')
})

export type SupabaseStorageAuth = z.infer<typeof supabaseStorageAuthSchema>

function readAuth(ctx: ToolContext): SupabaseStorageAuth {
	const parsed = supabaseStorageAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('Supabase storage credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function client(auth: SupabaseStorageAuth, ctx: ToolContext) {
	return createFetch({
		defaults: {
			baseURL: `${auth.url.replace(/\/+$/, '')}/storage/v1`,
			headers: {
				Authorization: `Bearer ${auth.serviceRoleKey}`,
				apikey: auth.serviceRoleKey
			},
			retry: false,
			ignoreResponseError: true,
			...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
			...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch })
		}
	})
}

function mapFetchError(error: unknown): never {
	if (error instanceof ToolError) throw error
	if (error instanceof FetchError) {
		throw new ToolError(error.message || 'Supabase storage request failed', {
			code: 'upstream',
			retryable: true,
			cause: error
		})
	}
	throw new ToolError('Supabase storage request failed', { code: 'upstream', retryable: true, cause: error })
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const bodyBuffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(bodyBuffer).set(bytes)
	return bodyBuffer
}

const ops: StorageOps = {
	list: async (input: ListObjectsInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = client(auth, ctx)
		const prefix = input.prefix ?? ''
		const limit = input.limit ?? 100
		const offset = input.cursor !== undefined ? Number.parseInt(input.cursor, 10) : 0
		if (input.cursor !== undefined && !Number.isFinite(offset)) {
			throw new ToolError('Invalid list cursor', { code: 'bad_input' })
		}
		try {
			const res = await $fetch.raw(`/object/list/${encodeURIComponent(auth.bucket)}`, {
				method: 'POST',
				body: {
					prefix,
					limit,
					offset: Number.isFinite(offset) ? offset : 0,
					...(input.delimiter === undefined ? {} : { delimiter: input.delimiter })
				}
			})
			if (!res.ok) {
				throwHttpStatus('Supabase list', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			}
			const data: unknown = res._data
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
				// folders often have null id
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
					...(size === undefined ? {} : { size }),
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
		} catch (error) {
			mapFetchError(error)
		}
	},

	get: async (input: GetObjectInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = client(auth, ctx)
		try {
			const res = await $fetch.raw(
				`/object/${encodeURIComponent(auth.bucket)}/${input.key.split('/').map(encodeURIComponent).join('/')}`,
				{
					method: 'GET',
					responseType: 'arrayBuffer'
				}
			)
			if (res.status === 404) throw new ToolError('Object not found', { code: 'not_found' })
			if (!res.ok) throwHttpStatus('Supabase get', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			const data: unknown = res._data
			let raw: Uint8Array | undefined
			if (data instanceof ArrayBuffer) raw = new Uint8Array(data)
			else if (ArrayBuffer.isView(data)) raw = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			if (raw === undefined) throw new ToolError('Supabase get returned non-binary body', { code: 'upstream' })
			if (raw.byteLength > MAX_OBJECT_BYTES) {
				throw new ToolError('Object exceeds 5 MiB download limit', {
					code: 'too_large',
					details: { max_bytes: MAX_OBJECT_BYTES, content_length: raw.byteLength }
				})
			}
			const encoding = input.encoding ?? 'base64'
			const body = encoding === 'utf8' ? bytesToUtf8(raw) : bytesToBase64(raw)
			const contentType = res.headers.get('content-type')
			return {
				key: input.key,
				body,
				encoding,
				content_length: raw.byteLength,
				...(isString(contentType) ? { content_type: contentType } : {})
			}
		} catch (error) {
			mapFetchError(error)
		}
	},

	put: async (input: PutObjectInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = client(auth, ctx)
		const encoding = input.body_encoding ?? 'utf8'
		let bodyBytes: Uint8Array
		try {
			bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		} catch (error) {
			throw new ToolError('Invalid body encoding for putObject', { code: 'bad_input', cause: error })
		}
		if (bodyBytes.byteLength > MAX_OBJECT_BYTES) {
			throw new ToolError('Object exceeds 5 MiB upload limit', {
				code: 'too_large',
				details: { max_bytes: MAX_OBJECT_BYTES, content_length: bodyBytes.byteLength }
			})
		}
		try {
			const res = await $fetch.raw(
				`/object/${encodeURIComponent(auth.bucket)}/${input.key.split('/').map(encodeURIComponent).join('/')}`,
				{
					method: 'POST',
					body: toArrayBuffer(bodyBytes),
					headers: {
						'Content-Type': input.content_type ?? 'application/octet-stream',
						'x-upsert': 'true'
					}
				}
			)
			if (!res.ok) throwHttpStatus('Supabase put', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			return { key: input.key, content_length: bodyBytes.byteLength }
		} catch (error) {
			mapFetchError(error)
		}
	},

	delete: async (input: DeleteObjectInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = client(auth, ctx)
		try {
			const res = await $fetch.raw(`/object/${encodeURIComponent(auth.bucket)}`, {
				method: 'DELETE',
				body: { prefixes: [input.key] }
			})
			if (!res.ok && res.status !== 404) {
				throwHttpStatus('Supabase delete', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			}
			return { key: input.key, deleted: true }
		} catch (error) {
			mapFetchError(error)
		}
	},

	head: async (input: HeadObjectInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = client(auth, ctx)
		try {
			const res = await $fetch.raw(
				`/object/info/${encodeURIComponent(auth.bucket)}/${input.key.split('/').map(encodeURIComponent).join('/')}`,
				{ method: 'GET' }
			)
			if (res.status === 404) return { key: input.key, exists: false }
			if (!res.ok) throwHttpStatus('Supabase head', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			const data: unknown = res._data
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
				...(size === undefined ? {} : { content_length: size }),
				...(contentType === undefined ? {} : { content_type: contentType })
			}
		} catch (error) {
			mapFetchError(error)
		}
	},

	copy: async (input: CopyObjectInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = client(auth, ctx)
		try {
			const res = await $fetch.raw(`/object/copy`, {
				method: 'POST',
				body: {
					bucketId: input.source_bucket ?? auth.bucket,
					sourceKey: input.source_key,
					destinationBucket: auth.bucket,
					destinationKey: input.destination_key
				}
			})
			if (!res.ok) throwHttpStatus('Supabase copy', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			return {
				source_key: input.source_key,
				destination_key: input.destination_key
			}
		} catch (error) {
			mapFetchError(error)
		}
	},

	getBytes: async (key, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = client(auth, ctx)
		try {
			const res = await $fetch.raw(
				`/object/${encodeURIComponent(auth.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`,
				{ method: 'GET', responseType: 'arrayBuffer' }
			)
			if (res.status === 404) throw new ToolError('Object not found', { code: 'not_found' })
			if (!res.ok) throwHttpStatus('Supabase get', res.status)
			const data: unknown = res._data
			if (data instanceof ArrayBuffer) return new Uint8Array(data)
			if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			throw new ToolError('Supabase get returned non-binary body', { code: 'upstream' })
		} catch (error) {
			mapFetchError(error)
		}
	},

	putBytes: async (key, bytes, contentType, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = client(auth, ctx)
		try {
			const res = await $fetch.raw(
				`/object/${encodeURIComponent(auth.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`,
				{
					method: 'POST',
					body: toArrayBuffer(bytes),
					headers: {
						'Content-Type': contentType ?? 'application/octet-stream',
						'x-upsert': 'true'
					}
				}
			)
			if (!res.ok) throwHttpStatus('Supabase put', res.status)
		} catch (error) {
			mapFetchError(error)
		}
	}
}

export const supabaseStorageProvider = defineProvider({
	id: 'supabase',
	title: 'Supabase Storage',
	authSchema: supabaseStorageAuthSchema,
	ops
})
