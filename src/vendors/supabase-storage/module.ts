import { defineModule, defineTool } from '../../core/define'
import { SupabaseStorageClient } from './client'
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
	supabaseStorageAuthSchema
} from './contracts'

export const supabaseStorageListObjectsTool = defineTool({
	id: 'supabase-storage-list-objects',
	name: 'supabaseStorageListObjects',
	description:
		'List objects in a Supabase Storage bucket. Use prefix, delimiter, cursor (offset), and limit for filtered pagination.',
	inputSchema: listObjectsInputSchema,
	outputSchema: listObjectsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseStorageClient.fromContext(ctx).list(input)
})

export const supabaseStorageGetObjectTool = defineTool({
	id: 'supabase-storage-get-object',
	name: 'supabaseStorageGetObject',
	description:
		'Download one Supabase Storage object by key. Bodies larger than 5 MiB fail. Body is base64 by default or utf8 when requested.',
	inputSchema: getObjectInputSchema,
	outputSchema: getObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseStorageClient.fromContext(ctx).get(input)
})

export const supabaseStoragePutObjectTool = defineTool({
	id: 'supabase-storage-put-object',
	name: 'supabaseStoragePutObject',
	description:
		'Upload or replace one Supabase Storage object by key (x-upsert). Provide utf8 text or base64 body. Bodies larger than 5 MiB fail.',
	inputSchema: putObjectInputSchema,
	outputSchema: putObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseStorageClient.fromContext(ctx).put(input)
})

export const supabaseStorageDeleteObjectTool = defineTool({
	id: 'supabase-storage-delete-object',
	name: 'supabaseStorageDeleteObject',
	description: 'Delete one Supabase Storage object by key. Idempotent for missing keys (404 allowed).',
	inputSchema: deleteObjectInputSchema,
	outputSchema: deleteObjectOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseStorageClient.fromContext(ctx).delete(input)
})

export const supabaseStorageHeadObjectTool = defineTool({
	id: 'supabase-storage-head-object',
	name: 'supabaseStorageHeadObject',
	description:
		'Inspect Supabase Storage object metadata by key without downloading the body. Returns exists plus content type and length when present.',
	inputSchema: headObjectInputSchema,
	outputSchema: headObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseStorageClient.fromContext(ctx).head(input)
})

export const supabaseStorageCopyObjectTool = defineTool({
	id: 'supabase-storage-copy-object',
	name: 'supabaseStorageCopyObject',
	description:
		'Copy one Supabase Storage object to a new key. Optional source_bucket when copying across buckets the service role can access.',
	inputSchema: copyObjectInputSchema,
	outputSchema: copyObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseStorageClient.fromContext(ctx).copy(input)
})

export const supabaseStorageModule = defineModule({
	id: 'supabase-storage',
	title: 'Supabase Storage',
	description:
		'Supabase Storage vendor pack via Storage REST (/storage/v1). List, get, put, delete, head, and copy. Host binds project URL, service role key, and bucket.',
	runtime: 'both',
	auth: { type: 'custom', schema: supabaseStorageAuthSchema },
	tools: [
		supabaseStorageListObjectsTool,
		supabaseStorageGetObjectTool,
		supabaseStoragePutObjectTool,
		supabaseStorageDeleteObjectTool,
		supabaseStorageHeadObjectTool,
		supabaseStorageCopyObjectTool
	]
})
