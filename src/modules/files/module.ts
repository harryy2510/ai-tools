import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import { requireAuth, resolveProvider } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import {
	filesCopyInputSchema,
	filesCopyOutputSchema,
	filesDeleteInputSchema,
	filesDeleteOutputSchema,
	filesGetInputSchema,
	filesGetOutputSchema,
	filesListInputSchema,
	filesListOutputSchema,
	filesMkdirInputSchema,
	filesMkdirOutputSchema,
	filesMoveInputSchema,
	filesMoveOutputSchema,
	filesMultipartAbortInputSchema,
	filesMultipartAbortOutputSchema,
	filesMultipartCompleteInputSchema,
	filesMultipartCompleteOutputSchema,
	filesMultipartStartInputSchema,
	filesMultipartStartOutputSchema,
	filesMultipartUploadPartInputSchema,
	filesMultipartUploadPartOutputSchema,
	filesPutInputSchema,
	filesPutOutputSchema,
	filesSearchInputSchema,
	filesSearchOutputSchema,
	filesStatInputSchema,
	filesStatOutputSchema
} from './contracts'
import type { FileItem } from './contracts'
import { basename, normalizeRootPrefix, resolveListPrefix, resolveUnderRoot, toRelativeKey } from './path'
import { storageAuthSchema, storageProviders } from '../storage/module'
import type { StorageOps } from '../storage/contracts'

export const filesAuthSchema = z.object({
	root_prefix: z
		.string()
		.min(1)
		.describe('Object key prefix for this workspace, for example orgs/acme/files/ (no leading slash)'),
	storage: storageAuthSchema.describe('Nested object storage binding (s3, r2, or supabase)')
})

export type FilesAuth = z.infer<typeof filesAuthSchema>

function readFilesAuth(ctx: ToolContext): FilesAuth {
	return requireAuth(ctx, filesAuthSchema)
}

function storageOps(auth: FilesAuth, ctx: ToolContext): { ops: StorageOps; storageCtx: ToolContext; root: string } {
	const root = normalizeRootPrefix(auth.root_prefix)
	const storageCtx: ToolContext = { ...ctx, auth: auth.storage }
	const ops = resolveProvider(storageProviders, auth.storage).ops
	return { ops, storageCtx, root }
}

function requireMultipart(ops: StorageOps): {
	createMultipartUpload: NonNullable<StorageOps['createMultipartUpload']>
	uploadPart: NonNullable<StorageOps['uploadPart']>
	completeMultipartUpload: NonNullable<StorageOps['completeMultipartUpload']>
	abortMultipartUpload: NonNullable<StorageOps['abortMultipartUpload']>
} {
	if (
		ops.createMultipartUpload === undefined ||
		ops.uploadPart === undefined ||
		ops.completeMultipartUpload === undefined ||
		ops.abortMultipartUpload === undefined
	) {
		throw new ToolError(
			'Multipart upload is not supported by the bound storage provider. Use storage provider s3 (S3-compatible endpoint) for multipart.',
			{ code: 'unsupported' }
		)
	}
	return {
		createMultipartUpload: ops.createMultipartUpload,
		uploadPart: ops.uploadPart,
		completeMultipartUpload: ops.completeMultipartUpload,
		abortMultipartUpload: ops.abortMultipartUpload
	}
}

const filesListTool = defineTool({
	id: 'files-list',
	name: 'listFiles',
	description:
		'List files and folders under a relative path in the bound workspace root. Paths are relative to the host root prefix. Returns names, kinds, sizes when known, and pagination fields. Does not return file body bytes.',
	inputSchema: filesListInputSchema,
	outputSchema: filesListOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const prefix = resolveListPrefix(root, input.path)
		const listed = await ops.list(
			{
				prefix,
				delimiter: '/',
				...(input.cursor === undefined ? {} : { cursor: input.cursor }),
				...(input.limit === undefined ? {} : { limit: input.limit })
			},
			storageCtx
		)

		const items: FileItem[] = []
		for (const obj of listed.items) {
			const rel = toRelativeKey(root, obj.key)
			if (rel === undefined || rel.length === 0) continue
			items.push({
				path: rel,
				kind: 'file',
				...(obj.size === undefined ? {} : { size: obj.size }),
				...(obj.last_modified === undefined ? {} : { last_modified: obj.last_modified }),
				...(obj.etag === undefined ? {} : { etag: obj.etag })
			})
		}
		if (listed.common_prefixes !== undefined) {
			for (const folderAbs of listed.common_prefixes) {
				const rel = toRelativeKey(root, folderAbs.endsWith('/') ? folderAbs.slice(0, -1) : folderAbs)
				if (rel === undefined || rel.length === 0) continue
				// Prefer trailing slash-free path with kind folder
				const folderPath = folderAbs.endsWith('/') ? (toRelativeKey(root, folderAbs.slice(0, -1)) ?? rel) : rel
				items.push({ path: folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath, kind: 'folder' })
			}
		}

		return filesListOutputSchema.parse({
			items,
			truncated: listed.truncated,
			...(listed.next_cursor === undefined ? {} : { next_cursor: listed.next_cursor })
		})
	}
})

const filesSearchTool = defineTool({
	id: 'files-search',
	name: 'searchFiles',
	description:
		'Search for files and folders by name fragment under the bound workspace root (optional relative folder). Matches the last path segment only; not full-text content search. Returns metadata without file body bytes.',
	inputSchema: filesSearchInputSchema,
	outputSchema: filesSearchOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const prefix = resolveListPrefix(root, input.path)
		const listed = await ops.list(
			{
				prefix,
				// No delimiter: search descendants under path
				...(input.cursor === undefined ? {} : { cursor: input.cursor }),
				...(input.limit === undefined ? {} : { limit: input.limit })
			},
			storageCtx
		)

		const needle = input.query.toLowerCase()
		const items: FileItem[] = []
		for (const obj of listed.items) {
			const rel = toRelativeKey(root, obj.key)
			if (rel === undefined || rel.length === 0) continue
			if (!basename(rel).toLowerCase().includes(needle)) continue
			items.push({
				path: rel,
				kind: 'file',
				...(obj.size === undefined ? {} : { size: obj.size }),
				...(obj.last_modified === undefined ? {} : { last_modified: obj.last_modified }),
				...(obj.etag === undefined ? {} : { etag: obj.etag })
			})
		}

		return filesSearchOutputSchema.parse({
			items,
			truncated: listed.truncated,
			...(listed.next_cursor === undefined ? {} : { next_cursor: listed.next_cursor })
		})
	}
})

const filesStatTool = defineTool({
	id: 'files-stat',
	name: 'statFile',
	description:
		'Get metadata for one relative file path under the bound workspace root (exists, size, content type, etag when known). Does not return file body bytes.',
	inputSchema: filesStatInputSchema,
	outputSchema: filesStatOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const absolute = resolveUnderRoot(root, input.path)
		const head = await ops.head({ key: absolute }, storageCtx)
		if (!head.exists) {
			return filesStatOutputSchema.parse({ exists: false })
		}
		const rel = toRelativeKey(root, head.key) ?? input.path
		return filesStatOutputSchema.parse({
			exists: true,
			item: {
				path: rel,
				kind: 'file',
				...(head.content_length === undefined ? {} : { size: head.content_length }),
				...(head.etag === undefined ? {} : { etag: head.etag }),
				...(head.content_type === undefined ? {} : { media_type: head.content_type })
			}
		})
	}
})

const filesGetTool = defineTool({
	id: 'files-get',
	name: 'getFile',
	description:
		'Download one file by relative path under the bound workspace root. Bodies larger than the storage provider limit fail. Returns body as base64 by default or utf8 when requested.',
	inputSchema: filesGetInputSchema,
	outputSchema: filesGetOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const absolute = resolveUnderRoot(root, input.path)
		const got = await ops.get(
			{
				key: absolute,
				...(input.encoding === undefined ? {} : { encoding: input.encoding })
			},
			storageCtx
		)
		return filesGetOutputSchema.parse({
			path: input.path,
			body: got.body,
			encoding: got.encoding,
			...(got.content_type === undefined ? {} : { content_type: got.content_type }),
			...(got.content_length === undefined ? {} : { content_length: got.content_length })
		})
	}
})

const filesPutTool = defineTool({
	id: 'files-put',
	name: 'putFile',
	description:
		'Upload or replace one file at a relative path under the bound workspace root. Provide utf8 text or base64 body. Paths cannot escape the root prefix.',
	inputSchema: filesPutInputSchema,
	outputSchema: filesPutOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const absolute = resolveUnderRoot(root, input.path)
		const put = await ops.put(
			{
				key: absolute,
				body: input.body,
				...(input.body_encoding === undefined ? {} : { body_encoding: input.body_encoding }),
				...(input.content_type === undefined ? {} : { content_type: input.content_type })
			},
			storageCtx
		)
		return filesPutOutputSchema.parse({
			path: input.path,
			content_length: put.content_length,
			...(put.etag === undefined ? {} : { etag: put.etag })
		})
	}
})

const filesDeleteTool = defineTool({
	id: 'files-delete',
	name: 'deleteFile',
	description:
		'Delete one file by relative path under the bound workspace root. Idempotent when the object is already missing.',
	inputSchema: filesDeleteInputSchema,
	outputSchema: filesDeleteOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const absolute = resolveUnderRoot(root, input.path)
		const result = await ops.delete({ key: absolute }, storageCtx)
		return filesDeleteOutputSchema.parse({ path: input.path, deleted: result.deleted })
	}
})

const filesCopyTool = defineTool({
	id: 'files-copy',
	name: 'copyFile',
	description:
		'Copy one file to a new relative path under the same bound workspace root. Both source and destination must stay inside the root prefix.',
	inputSchema: filesCopyInputSchema,
	outputSchema: filesCopyOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const source = resolveUnderRoot(root, input.source_path)
		const destination = resolveUnderRoot(root, input.destination_path)
		const result = await ops.copy({ source_key: source, destination_key: destination }, storageCtx)
		return filesCopyOutputSchema.parse({
			source_path: input.source_path,
			destination_path: input.destination_path,
			...(result.etag === undefined ? {} : { etag: result.etag })
		})
	}
})

const filesMkdirTool = defineTool({
	id: 'files-mkdir',
	name: 'makeFileDirectory',
	description:
		'Create a folder marker under the bound workspace root so the prefix is listable. Uses an empty .keep object inside the folder path.',
	inputSchema: filesMkdirInputSchema,
	outputSchema: filesMkdirOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const folder = input.path.trim().replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '')
		const keepRelative = `${folder}/.keep`
		const absolute = resolveUnderRoot(root, keepRelative)
		await ops.put(
			{
				key: absolute,
				body: '',
				body_encoding: 'utf8',
				content_type: 'application/x-directory'
			},
			storageCtx
		)
		return filesMkdirOutputSchema.parse({ path: folder, created: true })
	}
})

const filesMoveTool = defineTool({
	id: 'files-move',
	name: 'moveFile',
	description:
		'Move one file to a new relative path under the same bound workspace root (copy then delete source). Both paths must stay inside the root prefix. Destination is overwritten if it already exists when the store allows it.',
	inputSchema: filesMoveInputSchema,
	outputSchema: filesMoveOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const source = resolveUnderRoot(root, input.source_path)
		const destination = resolveUnderRoot(root, input.destination_path)
		if (source === destination) {
			throw new ToolError('source_path and destination_path must differ', { code: 'bad_input' })
		}
		const copied = await ops.copy({ source_key: source, destination_key: destination }, storageCtx)
		await ops.delete({ key: source }, storageCtx)
		return filesMoveOutputSchema.parse({
			source_path: input.source_path,
			destination_path: input.destination_path,
			...(copied.etag === undefined ? {} : { etag: copied.etag })
		})
	}
})

const filesMultipartStartTool = defineTool({
	id: 'files-multipart-start',
	name: 'startFileMultipartUpload',
	description:
		'Start a multipart upload for a relative path under the bound workspace root. Requires storage provider s3 (S3-compatible). Returns upload_id for part/complete/abort. Use when the file exceeds the single put limit.',
	inputSchema: filesMultipartStartInputSchema,
	outputSchema: filesMultipartStartOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const multipart = requireMultipart(ops)
		const absolute = resolveUnderRoot(root, input.path)
		const started = await multipart.createMultipartUpload(
			{
				key: absolute,
				...(input.content_type === undefined ? {} : { content_type: input.content_type })
			},
			storageCtx
		)
		return filesMultipartStartOutputSchema.parse({
			path: input.path,
			upload_id: started.upload_id
		})
	}
})

const filesMultipartUploadPartTool = defineTool({
	id: 'files-multipart-upload-part',
	name: 'uploadFileMultipartPart',
	description:
		'Upload one part of an in-progress multipart upload under the bound workspace root. Part bodies up to 25 MiB. S3 requires each part except the last to be at least 5 MiB. Returns etag required for complete.',
	inputSchema: filesMultipartUploadPartInputSchema,
	outputSchema: filesMultipartUploadPartOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const multipart = requireMultipart(ops)
		const absolute = resolveUnderRoot(root, input.path)
		const part = await multipart.uploadPart(
			{
				key: absolute,
				upload_id: input.upload_id,
				part_number: input.part_number,
				body: input.body,
				...(input.body_encoding === undefined ? {} : { body_encoding: input.body_encoding })
			},
			storageCtx
		)
		return filesMultipartUploadPartOutputSchema.parse({
			path: input.path,
			upload_id: input.upload_id,
			part_number: part.part_number,
			etag: part.etag,
			content_length: part.content_length
		})
	}
})

const filesMultipartCompleteTool = defineTool({
	id: 'files-multipart-complete',
	name: 'completeFileMultipartUpload',
	description:
		'Complete a multipart upload under the bound workspace root by assembling uploaded parts (part_number + etag). Parts may be in any order.',
	inputSchema: filesMultipartCompleteInputSchema,
	outputSchema: filesMultipartCompleteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const multipart = requireMultipart(ops)
		const absolute = resolveUnderRoot(root, input.path)
		const completed = await multipart.completeMultipartUpload(
			{
				key: absolute,
				upload_id: input.upload_id,
				parts: input.parts
			},
			storageCtx
		)
		return filesMultipartCompleteOutputSchema.parse({
			path: input.path,
			upload_id: input.upload_id,
			...(completed.etag === undefined ? {} : { etag: completed.etag })
		})
	}
})

const filesMultipartAbortTool = defineTool({
	id: 'files-multipart-abort',
	name: 'abortFileMultipartUpload',
	description:
		'Abort an in-progress multipart upload under the bound workspace root and discard uploaded parts for that upload_id.',
	inputSchema: filesMultipartAbortInputSchema,
	outputSchema: filesMultipartAbortOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		const auth = readFilesAuth(ctx)
		const { ops, storageCtx, root } = storageOps(auth, ctx)
		const multipart = requireMultipart(ops)
		const absolute = resolveUnderRoot(root, input.path)
		const aborted = await multipart.abortMultipartUpload({ key: absolute, upload_id: input.upload_id }, storageCtx)
		return filesMultipartAbortOutputSchema.parse({
			path: input.path,
			upload_id: input.upload_id,
			aborted: aborted.aborted
		})
	}
})

export const filesModule = defineModule({
	id: 'files',
	title: 'Files',
	description:
		'Manage files under a host-bound object storage root prefix. Paths are relative to that root. List, search, stat, get, put, delete, copy, move, mkdir, and S3-compatible multipart stay inside the root; host maps tenant to prefix and storage credentials.',
	runtime: 'both',
	auth: { type: 'custom', schema: filesAuthSchema },
	tools: [
		filesListTool,
		filesSearchTool,
		filesStatTool,
		filesGetTool,
		filesPutTool,
		filesDeleteTool,
		filesCopyTool,
		filesMoveTool,
		filesMkdirTool,
		filesMultipartStartTool,
		filesMultipartUploadPartTool,
		filesMultipartCompleteTool,
		filesMultipartAbortTool
	]
})

export {
	filesCopyTool,
	filesDeleteTool,
	filesGetTool,
	filesListTool,
	filesMkdirTool,
	filesMoveTool,
	filesMultipartAbortTool,
	filesMultipartCompleteTool,
	filesMultipartStartTool,
	filesMultipartUploadPartTool,
	filesPutTool,
	filesSearchTool,
	filesStatTool
}
