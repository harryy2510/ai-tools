import { AwsClient } from 'aws4fetch'
import { isNil, isString } from 'es-toolkit'
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
		.describe('Optional custom endpoint for S3-compatible stores such as R2 or MinIO'),
	sessionToken: z.string().min(1).optional().describe('Optional session token for temporary credentials')
})

export type S3StorageAuth = z.infer<typeof s3StorageAuthSchema>

const MAX_OBJECT_BYTES = 5 * 1024 * 1024
const DEFAULT_SIGNED_URL_SECONDS = 3600
const MAX_SIGNED_URL_SECONDS = 7 * 24 * 3600

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
		service: 's3',
		...(auth.sessionToken === undefined ? {} : { sessionToken: auth.sessionToken })
	})
}

function s3ErrorCode(status: number): 'bad_auth' | 'forbidden' | 'not_found' | 'rate_limited' | 'upstream' {
	if (status === 401) return 'bad_auth'
	if (status === 403) return 'forbidden'
	if (status === 404) return 'not_found'
	if (status === 429) return 'rate_limited'
	return 'upstream'
}

function throwHttp(operation: string, status: number): never {
	throw new ToolError(`S3 ${operation} failed with HTTP ${status}`, {
		code: s3ErrorCode(status),
		retryable: status >= 500 || status === 429,
		details: { status }
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

const listObjectSchema = z.object({
	key: z.string(),
	size: z.number().optional(),
	last_modified: z.string().optional(),
	etag: z.string().optional()
})

const listObjectsInput = z.object({
	prefix: z.string().optional().describe('Key prefix filter'),
	delimiter: z.string().optional().describe('Delimiter for common prefixes (folders), for example /'),
	continuation_token: z.string().optional().describe('Pagination token from a prior list call'),
	max_keys: z.number().int().min(1).max(1000).optional().describe('Maximum keys to return (1-1000)')
})

const listObjectsOutput = z.object({
	keys: z.array(z.string()).describe('Object keys (convenience list)'),
	objects: z.array(listObjectSchema).describe('Objects with size, last_modified, and etag when present'),
	common_prefixes: z.array(z.string()).optional().describe('Common prefixes when delimiter is set'),
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
	etag: z.string().optional(),
	content_length: z.number().describe('Decoded body byte length uploaded')
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

const copyObjectInput = z.object({
	source_key: z.string().min(1).describe('Source object key to copy from'),
	destination_key: z.string().min(1).describe('Destination object key to copy to'),
	source_bucket: z
		.string()
		.min(1)
		.optional()
		.describe('Optional source bucket when different from the configured default bucket')
})

const copyObjectOutput = z.object({
	source_key: z.string(),
	destination_key: z.string(),
	etag: z.string().optional()
})

const signedUrlInput = z.object({
	key: z.string().min(1).describe('Object key to sign'),
	method: z
		.enum(['GET', 'PUT', 'HEAD', 'DELETE'])
		.optional()
		.describe('HTTP method the URL authorizes. Defaults to GET'),
	expires_in: z
		.number()
		.int()
		.min(1)
		.max(MAX_SIGNED_URL_SECONDS)
		.optional()
		.describe('URL lifetime in seconds (1 to 604800). Defaults to 3600')
})

const signedUrlOutput = z.object({
	url: z.string().url().describe('Presigned URL'),
	method: z.enum(['GET', 'PUT', 'HEAD', 'DELETE']),
	expires_in: z.number().int().describe('Lifetime in seconds used when signing')
})

const listObjectsTool = defineTool({
	id: 's3-list-objects',
	name: 'listObjects',
	description:
		'List objects in the configured S3-compatible bucket. Use prefix, delimiter, and continuation_token for filtered pagination. Returns keys, rich object metadata, and truncation fields.',
	inputSchema: listObjectsInput,
	outputSchema: listObjectsOutput,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
		const params = new URLSearchParams({ 'list-type': '2' })
		if (input.prefix !== undefined) params.set('prefix', input.prefix)
		if (input.delimiter !== undefined) params.set('delimiter', input.delimiter)
		if (input.continuation_token !== undefined) {
			params.set('continuation-token', input.continuation_token)
		}
		if (input.max_keys !== undefined) params.set('max-keys', String(input.max_keys))

		const response = await signedFetch(auth, listUrl(auth, params), { method: 'GET' }, ctx)
		if (!response.ok) throwHttp('list', response.status)
		const xml = await response.text()
		const objects = parseListContents(xml)
		const keys = objects.map((o) => o.key)
		const isTruncated = xmlTag(xml, 'IsTruncated')[0]?.toLowerCase() === 'true'
		const next = xmlTag(xml, 'NextContinuationToken')[0]
		const commonFromBlocks: string[] = []
		for (const match of xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)) {
			const block = match[1]
			if (block === undefined) continue
			const prefix = xmlTag(block, 'Prefix')[0]
			if (prefix !== undefined) commonFromBlocks.push(decodeXmlEntities(prefix))
		}
		return listObjectsOutput.parse({
			keys,
			objects,
			is_truncated: isTruncated,
			...(commonFromBlocks.length > 0 ? { common_prefixes: commonFromBlocks } : {}),
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
		if (!response.ok) throwHttp('get', response.status)
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
		return getObjectOutput.parse({
			key: input.key,
			body,
			encoding,
			...(isString(contentType) ? { content_type: contentType } : {}),
			...(isNil(contentLength) || !Number.isFinite(contentLength)
				? { content_length: bytes.byteLength }
				: { content_length: contentLength })
		})
	}
})

const putObjectTool = defineTool({
	id: 's3-put-object',
	name: 'putObject',
	description:
		'Upload or replace one object by key in the configured S3-compatible bucket. Provide utf8 text or base64 body. Bodies larger than 5 MiB fail. Returns key, byte length, and optional ETag.',
	inputSchema: putObjectInput,
	outputSchema: putObjectOutput,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
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
		if (!response.ok) throwHttp('put', response.status)
		const etag = response.headers.get('etag')
		return putObjectOutput.parse({
			key: input.key,
			content_length: bodyBytes.byteLength,
			...(isString(etag) ? { etag: etag.replaceAll('"', '') } : {})
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
		if (!response.ok && response.status !== 404) throwHttp('delete', response.status)
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
		if (!response.ok) throwHttp('head', response.status)
		const contentType = response.headers.get('content-type')
		const lengthHeader = response.headers.get('content-length')
		const etag = response.headers.get('etag')
		const contentLength = isString(lengthHeader) ? Number.parseInt(lengthHeader, 10) : undefined
		return headObjectOutput.parse({
			key: input.key,
			exists: true,
			...(isString(contentType) ? { content_type: contentType } : {}),
			...(!isNil(contentLength) && Number.isFinite(contentLength) ? { content_length: contentLength } : {}),
			...(isString(etag) ? { etag: etag.replaceAll('"', '') } : {})
		})
	}
})

const copyObjectTool = defineTool({
	id: 's3-copy-object',
	name: 'copyObject',
	description:
		'Server-side copy one object to a new key in the configured S3-compatible bucket. Optional source_bucket when copying across buckets the credentials can access.',
	inputSchema: copyObjectInput,
	outputSchema: copyObjectOutput,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
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
		if (!response.ok) throwHttp('copy', response.status)
		const xml = await response.text()
		const etagRaw = xmlTag(xml, 'ETag')[0]
		const headerEtag = response.headers.get('etag')
		const etag =
			etagRaw !== undefined
				? decodeXmlEntities(etagRaw).replaceAll('"', '')
				: isString(headerEtag)
					? headerEtag.replaceAll('"', '')
					: undefined
		return copyObjectOutput.parse({
			source_key: input.source_key,
			destination_key: input.destination_key,
			...(etag === undefined || etag.length === 0 ? {} : { etag })
		})
	}
})

const createSignedUrlTool = defineTool({
	id: 's3-create-signed-url',
	name: 'createSignedUrl',
	description:
		'Create a time-limited presigned URL for one object key. Use method GET for download, PUT for upload, HEAD for metadata, DELETE for delete. Defaults to GET for 3600 seconds.',
	inputSchema: signedUrlInput,
	outputSchema: signedUrlOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readAuth(ctx)
		const method = input.method ?? 'GET'
		const expiresIn = input.expires_in ?? DEFAULT_SIGNED_URL_SECONDS
		const url = objectUrl(auth, input.key, `X-Amz-Expires=${expiresIn}`)
		const aws = clientFor(auth)
		try {
			const signed = await aws.sign(url, {
				method,
				aws: { signQuery: true }
			})
			return signedUrlOutput.parse({
				url: signed.url,
				method,
				expires_in: expiresIn
			})
		} catch (error) {
			throw new ToolError('Failed to create signed URL', {
				code: 'internal',
				cause: error
			})
		}
	}
})

export const s3StorageModule = defineModule({
	id: 's3-storage',
	title: 'S3 Storage',
	description:
		'S3-compatible object storage (AWS S3, Cloudflare R2, MinIO) for list, get, put, delete, head, copy, and presigned URLs.',
	runtime: 'both',
	auth: { type: 'custom', schema: s3StorageAuthSchema },
	tools: [
		listObjectsTool,
		getObjectTool,
		putObjectTool,
		deleteObjectTool,
		headObjectTool,
		copyObjectTool,
		createSignedUrlTool
	]
})

export {
	copyObjectTool,
	createSignedUrlTool,
	deleteObjectTool,
	getObjectTool,
	headObjectTool,
	listObjectsTool,
	putObjectTool
}
