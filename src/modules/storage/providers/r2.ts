import { isPlainObject, isString } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import {
	base64ToBytes,
	bytesToBase64,
	bytesToUtf8,
	encodeObjectKeyPath,
	toArrayBuffer,
	utf8ToBytes
} from '../../../shared/bytes'
import { HttpService } from '../../../transport/http-service'
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
 * Cloudflare R2 via the **Cloudflare REST API** (api.cloudflare.com).
 * For S3-compatible R2 endpoint, use provider `s3` + endpoint instead.
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

function createR2RestService(auth: R2StorageAuth, ctx: ToolContext) {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${auth.apiToken}`
	}
	if (auth.jurisdiction !== undefined) {
		headers['cf-r2-jurisdiction'] = auth.jurisdiction
	}
	const http = new HttpService({
		baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(auth.accountId)}/r2/buckets/${encodeURIComponent(auth.bucket)}`,
		headers,
		label: 'R2 REST',
		...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch }),
		...(ctx.signal === undefined ? {} : { signal: ctx.signal })
	})
	const label = 'R2 REST'
	const objectPath = (key: string) => `/objects/${encodeObjectKeyPath(key)}`

	return {
		list: (query: Record<string, string | number | boolean | undefined>) =>
			http.get('/objects', { label: `${label} list`, query }),
		getObject: (key: string) => http.bytes('GET', objectPath(key), { label: `${label} get` }),
		putObject: (key: string, bytes: Uint8Array, contentType: string) =>
			http.put(objectPath(key), toArrayBuffer(bytes), {
				label: `${label} put`,
				headers: { 'Content-Type': contentType }
			}),
		deleteObject: (key: string) =>
			http.delete(objectPath(key), {
				label: `${label} delete`,
				allowStatuses: [404]
			})
	}
}

type R2Service = ReturnType<typeof createR2RestService>

function service(ctx: ToolContext): R2Service {
	return createR2RestService(readAuth(ctx), ctx)
}

function assertCfEnvelope(data: unknown, operation: string): void {
	if (!isPlainObject(data)) return
	if (data['success'] !== false) return
	const errors = data['errors']
	let message = `R2 ${operation} failed`
	if (Array.isArray(errors) && errors.length > 0) {
		const first = errors[0]
		if (isPlainObject(first) && isString(first['message'])) {
			message = first['message']
		}
	}
	throw new ToolError(message, { code: 'upstream' })
}

function assertSize(bytes: Uint8Array, kind: 'download' | 'upload'): void {
	if (bytes.byteLength <= MAX_OBJECT_BYTES) return
	throw new ToolError(`Object exceeds 5 MiB ${kind} limit`, {
		code: 'too_large',
		details: { max_bytes: MAX_OBJECT_BYTES, content_length: bytes.byteLength }
	})
}

const ops: StorageOps = {
	list: async (input: ListObjectsInput, ctx) => {
		const svc = service(ctx)
		const { data } = await svc.list({
			...(input.prefix === undefined ? {} : { prefix: input.prefix }),
			...(input.delimiter === undefined ? {} : { delimiter: input.delimiter }),
			...(input.cursor === undefined ? {} : { cursor: input.cursor }),
			...(input.limit === undefined ? {} : { per_page: input.limit })
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
	},

	get: async (input: GetObjectInput, ctx) => {
		const svc = service(ctx)
		const { bytes, headers } = await svc.getObject(input.key)
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
	},

	put: async (input: PutObjectInput, ctx) => {
		const svc = service(ctx)
		const encoding = input.body_encoding ?? 'utf8'
		let bodyBytes: Uint8Array
		try {
			bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		} catch (error) {
			throw new ToolError('Invalid body encoding for putObject', { code: 'bad_input', cause: error })
		}
		assertSize(bodyBytes, 'upload')
		const { data } = await svc.putObject(input.key, bodyBytes, input.content_type ?? 'application/octet-stream')
		assertCfEnvelope(data, 'put')
		let etag: string | undefined
		if (isPlainObject(data) && isPlainObject(data['result']) && isString(data['result']['etag'])) {
			etag = data['result']['etag']
		}
		return {
			key: input.key,
			content_length: bodyBytes.byteLength,
			...(etag === undefined ? {} : { etag })
		}
	},

	delete: async (input: DeleteObjectInput, ctx) => {
		const svc = service(ctx)
		await svc.deleteObject(input.key)
		return { key: input.key, deleted: true }
	},

	head: async (input: HeadObjectInput, ctx) => {
		const svc = service(ctx)
		const { data } = await svc.list({ prefix: input.key, per_page: 1 })
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
			...(size === undefined ? {} : { content_length: size }),
			...(etag === undefined ? {} : { etag }),
			...(contentType === undefined ? {} : { content_type: contentType })
		}
	},

	copy: async (input: CopyObjectInput, ctx) => {
		if (input.source_bucket !== undefined) {
			throw new ToolError('R2 REST copy across buckets is not supported; use provider s3 (S3 API)', {
				code: 'unsupported'
			})
		}
		const svc = service(ctx)
		const { bytes, headers } = await svc.getObject(input.source_key)
		const contentType = headers.get('content-type') ?? 'application/octet-stream'
		await svc.putObject(input.destination_key, bytes, contentType)
		return {
			source_key: input.source_key,
			destination_key: input.destination_key
		}
	},

	getBytes: async (key, ctx) => {
		const { bytes } = await service(ctx).getObject(key)
		return bytes
	},

	putBytes: async (key, bytes, contentType, ctx) => {
		await service(ctx).putObject(key, bytes, contentType ?? 'application/octet-stream')
	}
}

export const r2StorageProvider = defineProvider({
	id: 'r2',
	title: 'Cloudflare R2 (REST API)',
	authSchema: r2StorageAuthSchema,
	ops
})
