import { isPlainObject, isString } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../core/provider'
import { ToolError } from '../core/errors'
import type { ToolContext } from '../core/types'
import {
	base64ToBytes,
	bytesToBase64,
	bytesToUtf8,
	encodeObjectKeyPath,
	toArrayBuffer,
	utf8ToBytes
} from '../shared/bytes'
import { HttpService } from '../transport/http-service'
import { MAX_OBJECT_BYTES } from '../modules/storage/contracts'
import type {
	CopyObjectInput,
	DeleteObjectInput,
	GetObjectInput,
	HeadObjectInput,
	ListObjectsInput,
	PutObjectInput,
	StorageOps
} from '../modules/storage/contracts'

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

/** Supabase Storage REST service (`/storage/v1`). */
function createSupabaseStorageService(auth: SupabaseStorageAuth, ctx: ToolContext) {
	const http = new HttpService({
		baseURL: `${auth.url.replace(/\/+$/, '')}/storage/v1`,
		headers: {
			Authorization: `Bearer ${auth.serviceRoleKey}`,
			apikey: auth.serviceRoleKey
		},
		label: 'Supabase storage',
		...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch }),
		...(ctx.signal === undefined ? {} : { signal: ctx.signal })
	})
	const bucket = encodeURIComponent(auth.bucket)
	const objectPath = (key: string) => `/object/${bucket}/${encodeObjectKeyPath(key)}`
	const label = 'Supabase storage'

	return {
		list: (body: Record<string, unknown>) => http.post(`/object/list/${bucket}`, body, { label: `${label} list` }),
		getObject: (key: string) => http.bytes('GET', objectPath(key), { label: `${label} get` }),
		putObject: (key: string, bytes: Uint8Array, contentType: string) =>
			http.post(objectPath(key), toArrayBuffer(bytes), {
				label: `${label} put`,
				headers: {
					'Content-Type': contentType,
					'x-upsert': 'true'
				}
			}),
		deleteObjects: (prefixes: string[]) =>
			http.query('DELETE', `/object/${bucket}`, {
				label: `${label} delete`,
				body: { prefixes },
				allowStatuses: [404]
			}),
		objectInfo: (key: string) =>
			http.get(`/object/info/${bucket}/${encodeObjectKeyPath(key)}`, {
				label: `${label} head`,
				allowStatuses: [404]
			}),
		copy: (body: { bucketId: string; sourceKey: string; destinationBucket: string; destinationKey: string }) =>
			http.post('/object/copy', body, { label: `${label} copy` })
	}
}

type SupabaseService = ReturnType<typeof createSupabaseStorageService>

function service(ctx: ToolContext): { auth: SupabaseStorageAuth; svc: SupabaseService } {
	const auth = readAuth(ctx)
	return { auth, svc: createSupabaseStorageService(auth, ctx) }
}

function decodeBody(bytes: Uint8Array, encoding: 'base64' | 'utf8'): string {
	return encoding === 'utf8' ? bytesToUtf8(bytes) : bytesToBase64(bytes)
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
		const { svc } = service(ctx)
		const prefix = input.prefix ?? ''
		const limit = input.limit ?? 100
		const offset = input.cursor !== undefined ? Number.parseInt(input.cursor, 10) : 0
		if (input.cursor !== undefined && !Number.isFinite(offset)) {
			throw new ToolError('Invalid list cursor', { code: 'bad_input' })
		}
		const { data } = await svc.list({
			prefix,
			limit,
			offset: Number.isFinite(offset) ? offset : 0,
			...(input.delimiter === undefined ? {} : { delimiter: input.delimiter })
		})
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
	},

	get: async (input: GetObjectInput, ctx) => {
		const { svc } = service(ctx)
		const { bytes, headers } = await svc.getObject(input.key)
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
	},

	put: async (input: PutObjectInput, ctx) => {
		const { svc } = service(ctx)
		const encoding = input.body_encoding ?? 'utf8'
		let bodyBytes: Uint8Array
		try {
			bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		} catch (error) {
			throw new ToolError('Invalid body encoding for putObject', { code: 'bad_input', cause: error })
		}
		assertSize(bodyBytes, 'upload')
		await svc.putObject(input.key, bodyBytes, input.content_type ?? 'application/octet-stream')
		return { key: input.key, content_length: bodyBytes.byteLength }
	},

	delete: async (input: DeleteObjectInput, ctx) => {
		const { svc } = service(ctx)
		await svc.deleteObjects([input.key])
		return { key: input.key, deleted: true }
	},

	head: async (input: HeadObjectInput, ctx) => {
		const { svc } = service(ctx)
		const { status, data } = await svc.objectInfo(input.key)
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
			...(size === undefined ? {} : { content_length: size }),
			...(contentType === undefined ? {} : { content_type: contentType })
		}
	},

	copy: async (input: CopyObjectInput, ctx) => {
		const { auth, svc } = service(ctx)
		await svc.copy({
			bucketId: input.source_bucket ?? auth.bucket,
			sourceKey: input.source_key,
			destinationBucket: auth.bucket,
			destinationKey: input.destination_key
		})
		return {
			source_key: input.source_key,
			destination_key: input.destination_key
		}
	},

	getBytes: async (key, ctx) => {
		const { svc } = service(ctx)
		const { bytes } = await svc.getObject(key)
		return bytes
	},

	putBytes: async (key, bytes, contentType, ctx) => {
		const { svc } = service(ctx)
		await svc.putObject(key, bytes, contentType ?? 'application/octet-stream')
	}
}

export const supabaseStorageProvider = defineProvider({
	id: 'supabase',
	title: 'Supabase Storage',
	authSchema: supabaseStorageAuthSchema,
	ops
})
