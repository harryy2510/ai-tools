import { defineModule, defineTool } from '../../core/define'
import { R2Client } from './client'
import {
	copyObjectInputSchema,
	copyObjectOutputSchema,
	deleteObjectInputSchema,
	deleteObjectOutputSchema,
	getObjectInputSchema,
	getObjectOutputSchema,
	headObjectInputSchema,
	headObjectOutputSchema,
	listObjectsInputSchema,
	listObjectsOutputSchema,
	putObjectInputSchema,
	putObjectOutputSchema,
	r2AuthSchema
} from './contracts'

export const r2ListObjectsTool = defineTool({
	id: 'r2-list-objects',
	name: 'r2ListObjects',
	description:
		'List objects in a Cloudflare R2 bucket via the REST API. Use prefix, delimiter, cursor, and limit for filtered pagination.',
	inputSchema: listObjectsInputSchema,
	outputSchema: listObjectsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => R2Client.fromContext(ctx).list(input)
})

export const r2GetObjectTool = defineTool({
	id: 'r2-get-object',
	name: 'r2GetObject',
	description:
		'Download one R2 object by key via Cloudflare REST. Bodies larger than 5 MiB fail. Body is base64 by default or utf8 when requested.',
	inputSchema: getObjectInputSchema,
	outputSchema: getObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => R2Client.fromContext(ctx).get(input)
})

export const r2PutObjectTool = defineTool({
	id: 'r2-put-object',
	name: 'r2PutObject',
	description:
		'Upload or replace one R2 object by key via Cloudflare REST. Provide utf8 text or base64 body. Bodies larger than 5 MiB fail.',
	inputSchema: putObjectInputSchema,
	outputSchema: putObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => R2Client.fromContext(ctx).put(input)
})

export const r2DeleteObjectTool = defineTool({
	id: 'r2-delete-object',
	name: 'r2DeleteObject',
	description: 'Delete one R2 object by key via Cloudflare REST. Idempotent for missing keys (404 allowed).',
	inputSchema: deleteObjectInputSchema,
	outputSchema: deleteObjectOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => R2Client.fromContext(ctx).delete(input)
})

export const r2HeadObjectTool = defineTool({
	id: 'r2-head-object',
	name: 'r2HeadObject',
	description:
		'Inspect R2 object metadata by key without downloading the body (list prefix match). Returns exists plus content type, length, and ETag when present.',
	inputSchema: headObjectInputSchema,
	outputSchema: headObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => R2Client.fromContext(ctx).head(input)
})

export const r2CopyObjectTool = defineTool({
	id: 'r2-copy-object',
	name: 'r2CopyObject',
	description:
		'Copy one R2 object to a new key in the same bucket via get+put. Cross-bucket copy is not supported on the REST API.',
	inputSchema: copyObjectInputSchema,
	outputSchema: copyObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => R2Client.fromContext(ctx).copy(input)
})

export const r2Module = defineModule({
	id: 'r2',
	title: 'Cloudflare R2 (REST API)',
	description:
		'Cloudflare R2 vendor pack via the Cloudflare REST API (api.cloudflare.com). List, get, put, delete, head, and same-bucket copy. For S3-compatible R2 endpoints, use an S3 client with endpoint instead.',
	runtime: 'both',
	auth: { type: 'custom', schema: r2AuthSchema },
	tools: [r2ListObjectsTool, r2GetObjectTool, r2PutObjectTool, r2DeleteObjectTool, r2HeadObjectTool, r2CopyObjectTool]
})
