import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { requireAuth, resolveProvider } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import {
	extractResultSchema,
	extractTextBatchInputSchema,
	extractTextBatchOutputSchema,
	extractTextInputSchema,
	statusInputSchema
} from './contracts'
import type { DocumentExtractOps } from './contracts'
import { textractExtractAuthSchema, textractExtractProvider } from './providers/textract'

export const documentExtractProviders = [textractExtractProvider] as const

export const documentExtractAuthSchema = z.discriminatedUnion('provider', [textractExtractAuthSchema])

export type DocumentExtractAuth = z.infer<typeof documentExtractAuthSchema>

function resolveOps(ctx: ToolContext): DocumentExtractOps {
	const auth = requireAuth(ctx, documentExtractAuthSchema)
	return resolveProvider(documentExtractProviders, auth).ops
}

const documentExtractTextTool = defineTool({
	id: 'document-extract-text',
	name: 'extractDocumentText',
	description:
		'Extract text from a document ArtifactRef in object storage. Polls until done or timeout. If still running after the wait budget, returns status pending and a job_id for document-extract-status. Source store must be object.',
	inputSchema: extractTextInputSchema,
	outputSchema: extractResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).extractText(input, ctx)
})

const documentExtractStatusTool = defineTool({
	id: 'document-extract-status',
	name: 'getDocumentExtractStatus',
	description:
		'Check a text-extraction job by job_id from document-extract-text. Returns succeeded with text, pending, or failed. Does not start a new job.',
	inputSchema: statusInputSchema,
	outputSchema: extractResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).getStatus(input, ctx)
})

const documentExtractTextBatchTool = defineTool({
	id: 'document-extract-text-batch',
	name: 'extractDocumentTextBatch',
	description:
		'Extract text from up to 10 document ArtifactRefs. Returns per-item status (succeeded, pending, failed) without aborting the whole batch.',
	inputSchema: extractTextBatchInputSchema,
	outputSchema: extractTextBatchOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		if (ops.extractTextBatch !== undefined) {
			return ops.extractTextBatch(input, ctx)
		}
		return runBatchItems(input.sources, async (source) => ops.extractText({ source }, ctx))
	}
})

export const documentExtractModule = defineModule({
	id: 'document-extract',
	title: 'Document Extract',
	description:
		'Extract text from documents in object storage via a bound provider (Amazon Textract or future providers). Polls inside extract; use status tool with job_id if the wait budget expires.',
	runtime: 'both',
	auth: { type: 'custom', schema: documentExtractAuthSchema },
	tools: [documentExtractTextTool, documentExtractStatusTool, documentExtractTextBatchTool]
})

export { documentExtractStatusTool, documentExtractTextBatchTool, documentExtractTextTool }
