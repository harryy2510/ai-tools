import { AwsClient } from 'aws4fetch'
import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import type { ToolContext } from '../../core/types'
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '../../shared/bytes'

export const s3StorageAuthSchema = z.object({
	accessKeyId: z.string().min(1).describe('S3 access key id'),
	secretAccessKey: z.string().min(1).describe('S3 secret access key'),
	region: z.string().min(1).describe('AWS region or R2 jurisdiction region string'),
	bucket: z.string().min(1).describe('Default bucket name'),
	endpoint: z
		.string()
		.url()
		.optional()
		.describe('Optional custom endpoint for S3-compatible stores such as R2 or MinIO')
})

export type S3StorageAuth = z.infer<typeof s3StorageAuthSchema>

const MAX_GET_BYTES = 5 * 1024 * 1024

function readAuth(ctx: ToolContext): S3StorageAuth {
	const parsed = s3StorageAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('S3 credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

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
		service: 's3'
	})
}

async function signedFetch(auth: S3StorageAuth, url: string, init: RequestInit, ctx: ToolContext): Promise<Response> {
	const aws = clientFor(auth)
	try {
		// aws4fetch signs then calls global fetch; hosts/tests mock globalThis.fetch when needed.
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

const listObjectsInput = z.object({
	prefix: z.string().optional().describe('Key prefix filter'),
	continuation_token: z.string().optional().describe('Pagination token from a prior list call'),
	max_keys: z.number().int().min(1).max(1000).optional().describe('Maximum keys to return (1-1000)')
})

const listObjectsOutput = z.object({
	keys: z.array(z.string()).describe('Object keys'),
	is_truncated: z.boolean().describe('Whether more results exist'),
	next_continuation_token: z.string().optional().describe('Pass as continuation_token to fetch the next page')
})

const getObjectInput = z.object({
	key: z.string().min(1).describe('Object key to download'),
	encoding: z.enum(['base64', 'utf8']).optional().describe('Body encoding. Defaults to base64 for binary safety')
})

const getObjectOutput = z.object({
	key: z.string(),
	content_type: z.string().optional(),
	content_length: z.number().optional(),
	body: z.string().describe('Object body encoded per encoding input'),
	encoding: z.enum(['base64', 'utf8'])
})

const putObjectInput = z.object({
	key: z.string().min(1).describe('Object key to write'),
	body: z.string().describe('Object body as utf8 text or base64 (see body_encoding)'),
	body_encoding: z.enum(['utf8', 'base64']).optional().describe('How to interpret body. Defaults to utf8'),
	content_type: z.string().optional().describe('Content-Type header to store')
})

const putObjectOutput = z.object({
	key: z.string(),
	etag: z.string().optional()
})

const deleteObjectInput = z.object({
	key: z.string().min(1).describe('Object key to delete')
})

const deleteObjectOutput = z.object({
	key: z.string(),
	deleted: z.boolean()
})

const headObjectInput = z.object({
	key: z.string().min(1).describe('Object key to inspect')
})

const headObjectOutput = z.object({
	key: z.string(),
	exists: z.boolean(),
	content_type: z.string().optional(),
	content_length: z.number().optional(),
	etag: z.string().optional()
})

const listObjectsTool = defineTool({
	id: 's3-list-objects',
	name: 'listObjects',
	description:
		'List object keys in the configured S3-compatible bucket. Use prefix and continuation_token for filtered pagination. Returns keys and truncation metadata.',
	inputSchema: listObjectsInput,
	outputSchema: listObjectsOutput,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
		const params = new URLSearchParams({ 'list-type': '2' })
		if (input.prefix !== undefined) params.set('prefix', input.prefix)
		if (input.continuation_token !== undefined) {
			params.set('continuation-token', input.continuation_token)
		}
		if (input.max_keys !== undefined) params.set('max-keys', String(input.max_keys))

		const response = await signedFetch(auth, listUrl(auth, params), { method: 'GET' }, ctx)
		if (!response.ok) {
			throw new ToolError(`S3 list failed with HTTP ${response.status}`, {
				code: response.status === 403 ? 'forbidden' : response.status === 404 ? 'not_found' : 'upstream',
				retryable: response.status >= 500 || response.status === 429
			})
		}
		const xml = await response.text()
		const keys = xmlTag(xml, 'Key')
		const isTruncated = xmlTag(xml, 'IsTruncated')[0]?.toLowerCase() === 'true'
		const next = xmlTag(xml, 'NextContinuationToken')[0]
		return listObjectsOutput.parse({
			keys,
			is_truncated: isTruncated,
			...(next === undefined ? {} : { next_continuation_token: next })
		})
	}
})

const getObjectTool = defineTool({
	id: 's3-get-object',
	name: 'getObject',
	description:
		'Download one object by key from the configured S3-compatible bucket. Bodies larger than 5 MiB fail. Returns body as base64 by default or utf8 when requested.',
	inputSchema: getObjectInput,
	outputSchema: getObjectOutput,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
		const response = await signedFetch(auth, objectUrl(auth, input.key), { method: 'GET' }, ctx)
		if (response.status === 404) {
			throw new ToolError('Object not found', { code: 'not_found' })
		}
		if (!response.ok) {
			throw new ToolError(`S3 get failed with HTTP ${response.status}`, {
				code: response.status === 403 ? 'forbidden' : 'upstream',
				retryable: response.status >= 500 || response.status === 429
			})
		}
		const lengthHeader = response.headers.get('content-length')
		const contentLength = lengthHeader === null ? undefined : Number.parseInt(lengthHeader, 10)
		if (contentLength !== undefined && Number.isFinite(contentLength) && contentLength > MAX_GET_BYTES) {
			throw new ToolError('Object exceeds 5 MiB download limit', { code: 'too_large' })
		}
		const bytes = new Uint8Array(await response.arrayBuffer())
		if (bytes.byteLength > MAX_GET_BYTES) {
			throw new ToolError('Object exceeds 5 MiB download limit', { code: 'too_large' })
		}
		const encoding = input.encoding ?? 'base64'
		const body = encoding === 'utf8' ? bytesToUtf8(bytes) : bytesToBase64(bytes)
		const contentType = response.headers.get('content-type')
		return getObjectOutput.parse({
			key: input.key,
			body,
			encoding,
			...(contentType === null ? {} : { content_type: contentType }),
			...(contentLength === undefined || !Number.isFinite(contentLength)
				? { content_length: bytes.byteLength }
				: { content_length: contentLength })
		})
	}
})

const putObjectTool = defineTool({
	id: 's3-put-object',
	name: 'putObject',
	description:
		'Upload or replace one object by key in the configured S3-compatible bucket. Provide utf8 text or base64 body. Returns key and optional ETag.',
	inputSchema: putObjectInput,
	outputSchema: putObjectOutput,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
		const encoding = input.body_encoding ?? 'utf8'
		const bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		const bodyBuffer = new ArrayBuffer(bodyBytes.byteLength)
		new Uint8Array(bodyBuffer).set(bodyBytes)
		const headers: Record<string, string> = {}
		if (input.content_type !== undefined) headers['Content-Type'] = input.content_type

		const response = await signedFetch(
			auth,
			objectUrl(auth, input.key),
			{
				method: 'PUT',
				body: bodyBuffer,
				headers
			},
			ctx
		)
		if (!response.ok) {
			throw new ToolError(`S3 put failed with HTTP ${response.status}`, {
				code: response.status === 403 ? 'forbidden' : 'upstream',
				retryable: response.status >= 500 || response.status === 429
			})
		}
		const etag = response.headers.get('etag')
		return putObjectOutput.parse({
			key: input.key,
			...(etag === null ? {} : { etag: etag.replaceAll('"', '') })
		})
	}
})

const deleteObjectTool = defineTool({
	id: 's3-delete-object',
	name: 'deleteObject',
	description:
		'Delete one object by key from the configured S3-compatible bucket. Idempotent for missing keys when the store returns success.',
	inputSchema: deleteObjectInput,
	outputSchema: deleteObjectOutput,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
		const response = await signedFetch(auth, objectUrl(auth, input.key), { method: 'DELETE' }, ctx)
		if (!response.ok && response.status !== 404) {
			throw new ToolError(`S3 delete failed with HTTP ${response.status}`, {
				code: response.status === 403 ? 'forbidden' : 'upstream',
				retryable: response.status >= 500 || response.status === 429
			})
		}
		return deleteObjectOutput.parse({ key: input.key, deleted: true })
	}
})

const headObjectTool = defineTool({
	id: 's3-head-object',
	name: 'headObject',
	description:
		'Inspect object metadata by key without downloading the body. Returns exists flag plus content type, length, and ETag when present.',
	inputSchema: headObjectInput,
	outputSchema: headObjectOutput,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
		const response = await signedFetch(auth, objectUrl(auth, input.key), { method: 'HEAD' }, ctx)
		if (response.status === 404) {
			return headObjectOutput.parse({ key: input.key, exists: false })
		}
		if (!response.ok) {
			throw new ToolError(`S3 head failed with HTTP ${response.status}`, {
				code: response.status === 403 ? 'forbidden' : 'upstream',
				retryable: response.status >= 500 || response.status === 429
			})
		}
		const contentType = response.headers.get('content-type')
		const lengthHeader = response.headers.get('content-length')
		const etag = response.headers.get('etag')
		const contentLength = lengthHeader === null ? undefined : Number.parseInt(lengthHeader, 10)
		return headObjectOutput.parse({
			key: input.key,
			exists: true,
			...(contentType === null ? {} : { content_type: contentType }),
			...(contentLength === undefined || !Number.isFinite(contentLength) ? {} : { content_length: contentLength }),
			...(etag === null ? {} : { etag: etag.replaceAll('"', '') })
		})
	}
})

export const s3StorageModule = defineModule({
	id: 's3-storage',
	title: 'S3 Storage',
	description: 'S3-compatible object storage (AWS S3, Cloudflare R2, MinIO) for list, get, put, delete, and head.',
	runtime: 'both',
	auth: { type: 'custom', schema: s3StorageAuthSchema },
	tools: [listObjectsTool, getObjectTool, putObjectTool, deleteObjectTool, headObjectTool]
})

export { deleteObjectTool, getObjectTool, headObjectTool, listObjectsTool, putObjectTool }
