import { isPlainObject, isString } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '../../../shared/bytes'
import { createServiceFetch, mapOfetchError } from '../../../shared/ofetch-client'
import { retryAfterMsFromHeader, throwHttpStatus } from '../../../shared/rate-limit'
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

/**
 * Cloudflare R2 via the **Cloudflare REST API** (api.cloudflare.com), not Workers bindings
 * and not the S3-compatible endpoint (use provider `s3` + endpoint for that).
 *
 * @see https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/
 */
export const r2StorageAuthSchema = z.object({
	provider: z.literal('r2'),
	accountId: z.string().min(1).describe('Cloudflare account id'),
	apiToken: z.string().min(1).describe('Cloudflare API token with R2 object permissions'),
	bucket: z.string().min(1).describe('R2 bucket name'),
	jurisdiction: z.enum(['default', 'eu', 'fedramp']).optional().describe('Optional cf-r2-jurisdiction header')
})

export type R2StorageAuth = z.infer<typeof r2StorageAuthSchema>

function readAuth(ctx: ToolContext): R2StorageAuth {
	const parsed = r2StorageAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('R2 REST credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function r2Client(auth: R2StorageAuth, ctx: ToolContext) {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${auth.apiToken}`
	}
	if (auth.jurisdiction !== undefined) {
		headers['cf-r2-jurisdiction'] = auth.jurisdiction
	}
	return createServiceFetch(
		{
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(auth.accountId)}/r2/buckets/${encodeURIComponent(auth.bucket)}`,
			headers
		},
		ctx
	)
}

/**
 * Object keys may contain `/`. CF docs: do not encode `/` as `%2F`; encode other reserved chars.
 */
function objectPath(key: string): string {
	return key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const bodyBuffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(bodyBuffer).set(bytes)
	return bodyBuffer
}

function assertCfSuccess(data: unknown, status: number, operation: string): void {
	if (status === 404) {
		throw new ToolError('Object not found', { code: 'not_found', details: { status } })
	}
	if (!isPlainObject(data)) {
		if (!status || status >= 400) {
			throwHttpStatus(`R2 ${operation}`, status)
		}
		return
	}
	if (data['success'] === false) {
		const errors = data['errors']
		let message = `R2 ${operation} failed`
		if (Array.isArray(errors) && errors.length > 0) {
			const first = errors[0]
			if (isPlainObject(first) && isString(first['message'])) {
				message = first['message']
			}
		}
		throw new ToolError(message, {
			code: status === 401 || status === 403 ? 'bad_auth' : status === 429 ? 'rate_limited' : 'upstream',
			retryable: status === 429 || status >= 500,
			details: { status }
		})
	}
}

function mapFetchError(error: unknown): never {
	mapOfetchError(error, 'R2 REST')
}

const ops: StorageOps = {
	list: async (input: ListObjectsInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = r2Client(auth, ctx)
		try {
			const res = await $fetch.raw('/objects', {
				method: 'GET',
				query: {
					...(input.prefix === undefined ? {} : { prefix: input.prefix }),
					...(input.delimiter === undefined ? {} : { delimiter: input.delimiter }),
					...(input.cursor === undefined ? {} : { cursor: input.cursor }),
					...(input.limit === undefined ? {} : { per_page: input.limit })
				}
			})
			if (!res.ok) {
				throwHttpStatus('R2 list', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			}
			const data: unknown = res._data
			assertCfSuccess(data, res.status, 'list')
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
						...(size === undefined ? {} : { size }),
						...(last_modified === undefined ? {} : { last_modified }),
						...(etag === undefined ? {} : { etag })
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
				...(next === undefined ? {} : { next_cursor: next }),
				...(common !== undefined && common.length > 0 ? { common_prefixes: common } : {})
			}
		} catch (error) {
			mapFetchError(error)
		}
	},

	get: async (input: GetObjectInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = r2Client(auth, ctx)
		try {
			const res = await $fetch.raw(`/objects/${objectPath(input.key)}`, {
				method: 'GET',
				responseType: 'arrayBuffer'
			})
			if (res.status === 404) throw new ToolError('Object not found', { code: 'not_found' })
			if (!res.ok) {
				throwHttpStatus('R2 get', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			}
			const data: unknown = res._data
			let raw: Uint8Array | undefined
			if (data instanceof ArrayBuffer) raw = new Uint8Array(data)
			else if (ArrayBuffer.isView(data)) raw = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			if (raw === undefined) {
				throw new ToolError('R2 get returned non-binary body', { code: 'upstream' })
			}
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
		const $fetch = r2Client(auth, ctx)
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
			const res = await $fetch.raw(`/objects/${objectPath(input.key)}`, {
				method: 'PUT',
				body: toArrayBuffer(bodyBytes),
				headers: {
					'Content-Type': input.content_type ?? 'application/octet-stream'
				}
			})
			if (!res.ok) {
				throwHttpStatus('R2 put', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			}
			const data: unknown = res._data
			assertCfSuccess(data, res.status, 'put')
			let etag: string | undefined
			if (isPlainObject(data) && isPlainObject(data['result']) && isString(data['result']['etag'])) {
				etag = data['result']['etag']
			}
			return {
				key: input.key,
				content_length: bodyBytes.byteLength,
				...(etag === undefined ? {} : { etag })
			}
		} catch (error) {
			mapFetchError(error)
		}
	},

	delete: async (input: DeleteObjectInput, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = r2Client(auth, ctx)
		try {
			const res = await $fetch.raw(`/objects/${objectPath(input.key)}`, { method: 'DELETE' })
			if (!res.ok && res.status !== 404) {
				throwHttpStatus('R2 delete', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			}
			return { key: input.key, deleted: true }
		} catch (error) {
			mapFetchError(error)
		}
	},

	head: async (input: HeadObjectInput, ctx) => {
		// REST has no dedicated HEAD; use list with exact prefix + per_page 1, or get with range.
		// Prefer list metadata when key matches a single object.
		const auth = readAuth(ctx)
		const $fetch = r2Client(auth, ctx)
		try {
			const res = await $fetch.raw('/objects', {
				method: 'GET',
				query: { prefix: input.key, per_page: 1 }
			})
			if (!res.ok) {
				throwHttpStatus('R2 head', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
			}
			const data: unknown = res._data
			assertCfSuccess(data, res.status, 'head')
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
				...(size === undefined ? {} : { content_length: size }),
				...(etag === undefined ? {} : { etag }),
				...(contentType === undefined ? {} : { content_type: contentType })
			}
		} catch (error) {
			mapFetchError(error)
		}
	},

	copy: async (input: CopyObjectInput, ctx) => {
		if (input.source_bucket !== undefined) {
			throw new ToolError('R2 REST copy across buckets is not supported; use provider s3 (S3 API)', {
				code: 'unsupported'
			})
		}
		// No server-side copy on REST objects API — get + put via raw bytes.
		const bytes = await ops.getBytes(input.source_key, ctx)
		const head = await ops.head({ key: input.source_key }, ctx)
		await ops.putBytes(input.destination_key, bytes, head.content_type, ctx)
		return {
			source_key: input.source_key,
			destination_key: input.destination_key
		}
	},

	// Presigned URLs are S3-API oriented; REST path uses Bearer tokens.
	// createSignedUrl omitted → tool returns unsupported

	getBytes: async (key, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = r2Client(auth, ctx)
		try {
			const res = await $fetch.raw(`/objects/${objectPath(key)}`, {
				method: 'GET',
				responseType: 'arrayBuffer'
			})
			if (res.status === 404) throw new ToolError('Object not found', { code: 'not_found' })
			if (!res.ok) throwHttpStatus('R2 get', res.status)
			const data: unknown = res._data
			if (data instanceof ArrayBuffer) return new Uint8Array(data)
			if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			throw new ToolError('R2 get returned non-binary body', { code: 'upstream' })
		} catch (error) {
			mapFetchError(error)
		}
	},

	putBytes: async (key, bytes, contentType, ctx) => {
		const auth = readAuth(ctx)
		const $fetch = r2Client(auth, ctx)
		try {
			const res = await $fetch.raw(`/objects/${objectPath(key)}`, {
				method: 'PUT',
				body: toArrayBuffer(bytes),
				headers: {
					'Content-Type': contentType ?? 'application/octet-stream'
				}
			})
			if (!res.ok) throwHttpStatus('R2 put', res.status)
			assertCfSuccess(res._data, res.status, 'put')
		} catch (error) {
			mapFetchError(error)
		}
	}
}

export const r2StorageProvider = defineProvider({
	id: 'r2',
	title: 'Cloudflare R2 (REST API)',
	authSchema: r2StorageAuthSchema,
	ops
})
