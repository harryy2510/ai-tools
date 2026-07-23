import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import { StorageClient } from './client'
import {
	abortMultipartUploadInputSchema,
	abortMultipartUploadOutputSchema,
	completeMultipartUploadInputSchema,
	completeMultipartUploadOutputSchema,
	copyObjectInputSchema,
	copyObjectOutputSchema,
	createMultipartUploadInputSchema,
	createMultipartUploadOutputSchema,
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
	signedUrlOutputSchema,
	storageAuthSchema,
	uploadPartInputSchema,
	uploadPartOutputSchema
} from './contracts'
import type { StorageOps } from './contracts'

export type { StorageAuth } from './contracts'
export { storageAuthSchema }

function client(ctx: ToolContext): StorageClient {
	return StorageClient.fromContext(ctx)
}

function requireMultipartOps(ops: StorageOps): {
	createMultipartUpload: NonNullable<StorageOps['createMultipartUpload']>
	uploadPart: NonNullable<StorageOps['uploadPart']>
	completeMultipartUpload: NonNullable<StorageOps['completeMultipartUpload']>
	abortMultipartUpload: NonNullable<StorageOps['abortMultipartUpload']>
} {
	const createMultipartUpload = ops.createMultipartUpload
	const uploadPart = ops.uploadPart
	const completeMultipartUpload = ops.completeMultipartUpload
	const abortMultipartUpload = ops.abortMultipartUpload
	if (!createMultipartUpload || !uploadPart || !completeMultipartUpload || !abortMultipartUpload) {
		throw new ToolError('Multipart upload is not supported by the bound storage provider', {
			code: 'unsupported'
		})
	}
	return {
		createMultipartUpload: (input) => createMultipartUpload.call(ops, input),
		uploadPart: (input) => uploadPart.call(ops, input),
		completeMultipartUpload: (input) => completeMultipartUpload.call(ops, input),
		abortMultipartUpload: (input) => abortMultipartUpload.call(ops, input)
	}
}

export const listObjectsTool = defineTool({
	id: 'storage-list-objects',
	name: 'listObjects',
	description:
		'List objects in the bound object store. Use prefix, delimiter, cursor, and limit for filtered pagination. Returns keys, items with metadata, next_cursor, and truncated.',
	inputSchema: listObjectsInputSchema,
	outputSchema: listObjectsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => client(ctx).list(input)
})

export const getObjectTool = defineTool({
	id: 'storage-get-object',
	name: 'getObject',
	description:
		'Download one object by key. Bodies larger than 5 MiB fail. Returns body as base64 by default or utf8 when requested.',
	inputSchema: getObjectInputSchema,
	outputSchema: getObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => client(ctx).get(input)
})

export const putObjectTool = defineTool({
	id: 'storage-put-object',
	name: 'putObject',
	description: 'Upload or replace one object by key. Provide utf8 text or base64 body. Bodies larger than 5 MiB fail.',
	inputSchema: putObjectInputSchema,
	outputSchema: putObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => client(ctx).put(input)
})

export const deleteObjectTool = defineTool({
	id: 'storage-delete-object',
	name: 'deleteObject',
	description: 'Delete one object by key. Idempotent for missing keys when the store returns success.',
	inputSchema: deleteObjectInputSchema,
	outputSchema: deleteObjectOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => client(ctx).delete(input)
})

export const headObjectTool = defineTool({
	id: 'storage-head-object',
	name: 'headObject',
	description:
		'Inspect object metadata by key without downloading the body. Returns exists flag plus content type, length, and ETag when present.',
	inputSchema: headObjectInputSchema,
	outputSchema: headObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => client(ctx).head(input)
})

export const copyObjectTool = defineTool({
	id: 'storage-copy-object',
	name: 'copyObject',
	description:
		'Copy one object to a new key in the bound store. Optional source_bucket when copying across buckets the credentials can access.',
	inputSchema: copyObjectInputSchema,
	outputSchema: copyObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => client(ctx).copy(input)
})

export const createSignedUrlTool = defineTool({
	id: 'storage-create-signed-url',
	name: 'createSignedUrl',
	description:
		'Create a time-limited presigned URL for one object key when the bound provider supports it. Defaults to GET for 3600 seconds.',
	inputSchema: signedUrlInputSchema,
	outputSchema: signedUrlOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = client(ctx).ops
		if (!ops.createSignedUrl) {
			throw new ToolError('Signed URLs are not supported by the bound storage provider', {
				code: 'unsupported'
			})
		}
		return ops.createSignedUrl(input)
	}
})

export const createMultipartUploadTool = defineTool({
	id: 'storage-create-multipart-upload',
	name: 'createMultipartUpload',
	description:
		'Start an S3-compatible multipart upload for one object key when the bound provider supports it. Returns upload_id for uploadPart/complete/abort. Use for objects larger than the single put limit. R2 REST and Supabase Storage REST do not support this path.',
	inputSchema: createMultipartUploadInputSchema,
	outputSchema: createMultipartUploadOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => requireMultipartOps(client(ctx).ops).createMultipartUpload(input)
})

export const uploadPartTool = defineTool({
	id: 'storage-upload-part',
	name: 'uploadPart',
	description:
		'Upload one part of an in-progress multipart upload. Part bodies up to 25 MiB. S3 requires each part except the last to be at least 5 MiB. Returns etag required for completeMultipartUpload.',
	inputSchema: uploadPartInputSchema,
	outputSchema: uploadPartOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => requireMultipartOps(client(ctx).ops).uploadPart(input)
})

export const completeMultipartUploadTool = defineTool({
	id: 'storage-complete-multipart-upload',
	name: 'completeMultipartUpload',
	description:
		'Finish a multipart upload by assembling uploaded parts (part_number + etag). Parts may be supplied in any order; they are sorted by part_number before complete.',
	inputSchema: completeMultipartUploadInputSchema,
	outputSchema: completeMultipartUploadOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => requireMultipartOps(client(ctx).ops).completeMultipartUpload(input)
})

export const abortMultipartUploadTool = defineTool({
	id: 'storage-abort-multipart-upload',
	name: 'abortMultipartUpload',
	description: 'Abort an in-progress multipart upload and discard uploaded parts for that upload_id.',
	inputSchema: abortMultipartUploadInputSchema,
	outputSchema: abortMultipartUploadOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => requireMultipartOps(client(ctx).ops).abortMultipartUpload(input)
})

export const getObjectsTool = defineTool({
	id: 'storage-get-objects',
	name: 'getObjects',
	description:
		'Download multiple objects by key (max 25). Returns per-item success or error without aborting the whole batch.',
	inputSchema: getObjectsInputSchema,
	outputSchema: getObjectsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const c = client(ctx)
		const encoding = input.encoding
		return runBatchItems(input.keys, async (key) => c.get({ key, ...(encoding && { encoding }) }))
	}
})

export const putObjectsTool = defineTool({
	id: 'storage-put-objects',
	name: 'putObjects',
	description: 'Upload multiple objects (max 25). Returns per-item success or error without aborting the whole batch.',
	inputSchema: putObjectsInputSchema,
	outputSchema: putObjectsOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const c = client(ctx)
		return runBatchItems(input.objects, async (object) => c.put(object))
	}
})

export const deleteObjectsTool = defineTool({
	id: 'storage-delete-objects',
	name: 'deleteObjects',
	description:
		'Delete multiple objects by key (max 25). Returns per-item success or error without aborting the whole batch.',
	inputSchema: deleteObjectsInputSchema,
	outputSchema: deleteObjectsOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		const c = client(ctx)
		return runBatchItems(input.keys, async (key) => c.delete({ key }))
	}
})

export const storageModule = defineModule({
	id: 'storage',
	title: 'Object Storage',
	description:
		'Object storage via the host-bound provider. List, get, put, delete, head, copy, signed URLs and multipart when supported, and batch variants.',
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
		createMultipartUploadTool,
		uploadPartTool,
		completeMultipartUploadTool,
		abortMultipartUploadTool,
		getObjectsTool,
		putObjectsTool,
		deleteObjectsTool
	]
})
