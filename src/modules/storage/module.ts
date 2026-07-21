import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { requireAuth, resolveProvider } from '../../core/provider'
import { ToolError } from '../../core/errors'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import {
	copyObjectInputSchema,
	copyObjectOutputSchema,
	deleteObjectInputSchema,
	deleteObjectOutputSchema,
	deleteObjectsInputSchema,
	deleteObjectsOutputSchema,
	getObjectInputSchema,
	getObjectOutputSchema,
	getObjectsInputSchema,
	getObjectsOutputSchema,
	headObjectInputSchema,
	headObjectOutputSchema,
	listObjectsInputSchema,
	listObjectsOutputSchema,
	putObjectInputSchema,
	putObjectOutputSchema,
	putObjectsInputSchema,
	putObjectsOutputSchema,
	signedUrlInputSchema,
	signedUrlOutputSchema
} from './contracts'
import type { StorageOps } from './contracts'
import { r2StorageAuthSchema, r2StorageProvider } from './providers/r2'
import { s3StorageAuthSchema, s3StorageProvider } from './providers/s3'
import { supabaseStorageAuthSchema, supabaseStorageProvider } from './providers/supabase'

export const storageProviders = [s3StorageProvider, r2StorageProvider, supabaseStorageProvider] as const

export const storageAuthSchema = z.discriminatedUnion('provider', [
	s3StorageAuthSchema,
	r2StorageAuthSchema,
	supabaseStorageAuthSchema
])

export type StorageAuth = z.infer<typeof storageAuthSchema>

function resolveOps(ctx: ToolContext): StorageOps {
	const auth = requireAuth(ctx, storageAuthSchema)
	return resolveProvider(storageProviders, auth).ops
}

const listObjectsTool = defineTool({
	id: 'storage-list-objects',
	name: 'listObjects',
	description:
		'List objects in the bound object store. Use prefix, delimiter, cursor, and limit for filtered pagination. Returns keys, items with metadata, next_cursor, and truncated.',
	inputSchema: listObjectsInputSchema,
	outputSchema: listObjectsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).list(input, ctx)
})

const getObjectTool = defineTool({
	id: 'storage-get-object',
	name: 'getObject',
	description:
		'Download one object by key. Bodies larger than 5 MiB fail. Returns body as base64 by default or utf8 when requested.',
	inputSchema: getObjectInputSchema,
	outputSchema: getObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).get(input, ctx)
})

const putObjectTool = defineTool({
	id: 'storage-put-object',
	name: 'putObject',
	description: 'Upload or replace one object by key. Provide utf8 text or base64 body. Bodies larger than 5 MiB fail.',
	inputSchema: putObjectInputSchema,
	outputSchema: putObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).put(input, ctx)
})

const deleteObjectTool = defineTool({
	id: 'storage-delete-object',
	name: 'deleteObject',
	description: 'Delete one object by key. Idempotent for missing keys when the store returns success.',
	inputSchema: deleteObjectInputSchema,
	outputSchema: deleteObjectOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).delete(input, ctx)
})

const headObjectTool = defineTool({
	id: 'storage-head-object',
	name: 'headObject',
	description:
		'Inspect object metadata by key without downloading the body. Returns exists flag plus content type, length, and ETag when present.',
	inputSchema: headObjectInputSchema,
	outputSchema: headObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).head(input, ctx)
})

const copyObjectTool = defineTool({
	id: 'storage-copy-object',
	name: 'copyObject',
	description:
		'Copy one object to a new key in the bound store. Optional source_bucket when copying across buckets the credentials can access.',
	inputSchema: copyObjectInputSchema,
	outputSchema: copyObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).copy(input, ctx)
})

const createSignedUrlTool = defineTool({
	id: 'storage-create-signed-url',
	name: 'createSignedUrl',
	description:
		'Create a time-limited presigned URL for one object key when the bound provider supports it. Defaults to GET for 3600 seconds.',
	inputSchema: signedUrlInputSchema,
	outputSchema: signedUrlOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		if (ops.createSignedUrl === undefined) {
			throw new ToolError('Signed URLs are not supported by the bound storage provider', {
				code: 'unsupported'
			})
		}
		return ops.createSignedUrl(input, ctx)
	}
})

const getObjectsTool = defineTool({
	id: 'storage-get-objects',
	name: 'getObjects',
	description:
		'Download multiple objects by key (max 25). Returns per-item success or error without aborting the whole batch.',
	inputSchema: getObjectsInputSchema,
	outputSchema: getObjectsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		const encoding = input.encoding
		return runBatchItems(input.keys, async (key) =>
			ops.get({ key, ...(encoding === undefined ? {} : { encoding }) }, ctx)
		)
	}
})

const putObjectsTool = defineTool({
	id: 'storage-put-objects',
	name: 'putObjects',
	description: 'Upload multiple objects (max 25). Returns per-item success or error without aborting the whole batch.',
	inputSchema: putObjectsInputSchema,
	outputSchema: putObjectsOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		return runBatchItems(input.objects, async (object) => ops.put(object, ctx))
	}
})

const deleteObjectsTool = defineTool({
	id: 'storage-delete-objects',
	name: 'deleteObjects',
	description:
		'Delete multiple objects by key (max 25). Returns per-item success or error without aborting the whole batch.',
	inputSchema: deleteObjectsInputSchema,
	outputSchema: deleteObjectsOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		return runBatchItems(input.keys, async (key) => ops.delete({ key }, ctx))
	}
})

export const storageModule = defineModule({
	id: 'storage',
	title: 'Object Storage',
	description:
		'Object storage with provider seam (S3/S3-compatible, native R2 binding, Supabase Storage). List, get, put, delete, head, copy, signed URLs, and batch variants.',
	runtime: 'both',
	auth: { type: 'custom', schema: storageAuthSchema },
	tools: [
		listObjectsTool,
		getObjectTool,
		putObjectTool,
		deleteObjectTool,
		headObjectTool,
		copyObjectTool,
		createSignedUrlTool,
		getObjectsTool,
		putObjectsTool,
		deleteObjectsTool
	]
})

export {
	copyObjectTool,
	createSignedUrlTool,
	deleteObjectTool,
	deleteObjectsTool,
	getObjectTool,
	getObjectsTool,
	headObjectTool,
	listObjectsTool,
	putObjectTool,
	putObjectsTool
}
