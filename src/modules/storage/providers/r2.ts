import { isPlainObject, isString } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '../../../shared/bytes'
import { MAX_OBJECT_BYTES } from '../contracts'
import type {
	CopyObjectInput,
	DeleteObjectInput,
	GetObjectInput,
	HeadObjectInput,
	ListObjectsInput,
	StorageOps
} from '../contracts'

/**
 * Native Cloudflare R2 via Workers binding.
 * Host must inject `ctx.extras.r2Buckets` as Record<bucketName, R2Bucket-like>.
 */
export const r2StorageAuthSchema = z.object({
	provider: z.literal('r2'),
	bucket: z.string().min(1).describe('R2 bucket binding name (key in ctx.extras.r2Buckets)')
})

export type R2StorageAuth = z.infer<typeof r2StorageAuthSchema>

type R2Object = {
	key: string
	size: number
	etag?: string
	uploaded?: Date
	httpMetadata?: { contentType?: string }
	writeHttpMetadata?: (headers: Headers) => void
	arrayBuffer: () => Promise<ArrayBuffer>
}

type R2ObjectsList = {
	objects: R2Object[]
	truncated: boolean
	cursor?: string
	delimitedPrefixes?: string[]
}

type R2BucketLike = {
	get: (key: string) => Promise<R2Object | null>
	put: (
		key: string,
		value: ArrayBuffer | string,
		options?: { httpMetadata?: { contentType?: string } }
	) => Promise<R2Object | null>
	delete: (keys: string | string[]) => Promise<void>
	head: (key: string) => Promise<R2Object | null>
	list: (options?: { prefix?: string; delimiter?: string; cursor?: string; limit?: number }) => Promise<R2ObjectsList>
}

function readR2Auth(ctx: ToolContext): R2StorageAuth {
	const parsed = r2StorageAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('R2 storage credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function bucketFromExtras(auth: R2StorageAuth, ctx: ToolContext): R2BucketLike {
	const extras = ctx.extras
	if (!isPlainObject(extras)) {
		throw new ToolError('R2 host binding missing: set ctx.extras.r2Buckets', { code: 'bad_auth' })
	}
	const map = extras['r2Buckets']
	if (!isPlainObject(map)) {
		throw new ToolError('R2 host binding missing: set ctx.extras.r2Buckets', { code: 'bad_auth' })
	}
	const candidate = map[auth.bucket]
	if (!isPlainObject(candidate)) {
		throw new ToolError(`R2 bucket binding not found: ${auth.bucket}`, { code: 'bad_auth' })
	}
	const get = candidate['get']
	const put = candidate['put']
	const del = candidate['delete']
	const head = candidate['head']
	const list = candidate['list']
	if (
		typeof get !== 'function' ||
		typeof put !== 'function' ||
		typeof del !== 'function' ||
		typeof head !== 'function' ||
		typeof list !== 'function'
	) {
		throw new ToolError(`R2 bucket binding invalid: ${auth.bucket}`, { code: 'bad_auth' })
	}
	return {
		get: (key) => Promise.resolve(get.call(candidate, key)),
		put: (key, value, options) => Promise.resolve(put.call(candidate, key, value, options)),
		delete: (keys) => Promise.resolve(del.call(candidate, keys)),
		head: (key) => Promise.resolve(head.call(candidate, key)),
		list: (options) => Promise.resolve(list.call(candidate, options))
	}
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const bodyBuffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(bodyBuffer).set(bytes)
	return bodyBuffer
}

const ops: StorageOps = {
	list: async (input: ListObjectsInput, ctx) => {
		const auth = readR2Auth(ctx)
		const bucket = bucketFromExtras(auth, ctx)
		const listed = await bucket.list({
			...(input.prefix === undefined ? {} : { prefix: input.prefix }),
			...(input.delimiter === undefined ? {} : { delimiter: input.delimiter }),
			...(input.cursor === undefined ? {} : { cursor: input.cursor }),
			...(input.limit === undefined ? {} : { limit: input.limit })
		})
		const items = listed.objects.map((obj) => ({
			key: obj.key,
			size: obj.size,
			...(obj.etag === undefined ? {} : { etag: obj.etag }),
			...(obj.uploaded === undefined ? {} : { last_modified: obj.uploaded.toISOString() })
		}))
		return {
			keys: items.map((i) => i.key),
			items,
			truncated: listed.truncated,
			...(listed.cursor === undefined || listed.cursor.length === 0 ? {} : { next_cursor: listed.cursor }),
			...(listed.delimitedPrefixes !== undefined && listed.delimitedPrefixes.length > 0
				? { common_prefixes: listed.delimitedPrefixes }
				: {})
		}
	},

	get: async (input: GetObjectInput, ctx) => {
		const auth = readR2Auth(ctx)
		const bucket = bucketFromExtras(auth, ctx)
		const obj = await bucket.get(input.key)
		if (obj === null) throw new ToolError('Object not found', { code: 'not_found' })
		if (obj.size > MAX_OBJECT_BYTES) {
			throw new ToolError('Object exceeds 5 MiB download limit', {
				code: 'too_large',
				details: { max_bytes: MAX_OBJECT_BYTES, content_length: obj.size }
			})
		}
		const bytes = new Uint8Array(await obj.arrayBuffer())
		const encoding = input.encoding ?? 'base64'
		const body = encoding === 'utf8' ? bytesToUtf8(bytes) : bytesToBase64(bytes)
		const contentType = obj.httpMetadata?.contentType
		return {
			key: input.key,
			body,
			encoding,
			content_length: bytes.byteLength,
			...(isString(contentType) ? { content_type: contentType } : {})
		}
	},

	put: async (input, ctx) => {
		const auth = readR2Auth(ctx)
		const bucket = bucketFromExtras(auth, ctx)
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
		const putOptions =
			input.content_type === undefined ? undefined : { httpMetadata: { contentType: input.content_type } }
		const result = await bucket.put(input.key, toArrayBuffer(bodyBytes), putOptions)
		return {
			key: input.key,
			content_length: bodyBytes.byteLength,
			...(result?.etag === undefined ? {} : { etag: result.etag })
		}
	},

	delete: async (input: DeleteObjectInput, ctx) => {
		const auth = readR2Auth(ctx)
		const bucket = bucketFromExtras(auth, ctx)
		await bucket.delete(input.key)
		return { key: input.key, deleted: true }
	},

	head: async (input: HeadObjectInput, ctx) => {
		const auth = readR2Auth(ctx)
		const bucket = bucketFromExtras(auth, ctx)
		const obj = await bucket.head(input.key)
		if (obj === null) return { key: input.key, exists: false }
		const contentType = obj.httpMetadata?.contentType
		return {
			key: input.key,
			exists: true,
			content_length: obj.size,
			...(isString(contentType) ? { content_type: contentType } : {}),
			...(obj.etag === undefined ? {} : { etag: obj.etag })
		}
	},

	copy: async (input: CopyObjectInput, ctx) => {
		// R2 binding has no server-side copy; get + put.
		const auth = readR2Auth(ctx)
		const bucket = bucketFromExtras(auth, ctx)
		if (input.source_bucket !== undefined && input.source_bucket !== auth.bucket) {
			throw new ToolError('Native R2 copy across bindings is not supported', { code: 'unsupported' })
		}
		const obj = await bucket.get(input.source_key)
		if (obj === null) throw new ToolError('Object not found', { code: 'not_found' })
		const bytes = await obj.arrayBuffer()
		const contentType = obj.httpMetadata?.contentType
		const putOptions = contentType === undefined ? undefined : { httpMetadata: { contentType } }
		const result = await bucket.put(input.destination_key, bytes, putOptions)
		return {
			source_key: input.source_key,
			destination_key: input.destination_key,
			...(result?.etag === undefined ? {} : { etag: result.etag })
		}
	},

	getBytes: async (key, ctx) => {
		const auth = readR2Auth(ctx)
		const bucket = bucketFromExtras(auth, ctx)
		const obj = await bucket.get(key)
		if (obj === null) throw new ToolError('Object not found', { code: 'not_found' })
		return new Uint8Array(await obj.arrayBuffer())
	},

	putBytes: async (key, bytes, contentType, ctx) => {
		const auth = readR2Auth(ctx)
		const bucket = bucketFromExtras(auth, ctx)
		const putOptions = isString(contentType) && contentType.length > 0 ? { httpMetadata: { contentType } } : undefined
		await bucket.put(key, toArrayBuffer(bytes), putOptions)
	}
}

export const r2StorageProvider = defineProvider({
	id: 'r2',
	title: 'Cloudflare R2 (native binding)',
	authSchema: r2StorageAuthSchema,
	ops
})
