import { z } from 'zod'

import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import { batchResultSchema } from '../../shared/batch'

export const MAX_BATCH_EXTRACT = 10

export const extractResultSchema = z.object({
	status: z.enum(['succeeded', 'pending', 'failed']),
	job_id: z.string().optional(),
	text: z.string().optional(),
	page_count: z.int().optional(),
	error: z.string().optional(),
	source: artifactRefSchema.optional()
})

export const extractTextInputSchema = z.object({
	source: artifactRefSchema.describe('Document ArtifactRef in object storage (store must be object)')
})

export const extractTextBatchInputSchema = z.object({
	sources: z
		.array(artifactRefSchema)
		.min(1)
		.max(MAX_BATCH_EXTRACT)
		.describe('Document ArtifactRefs to extract (max 10)')
})

export const statusInputSchema = z.object({
	job_id: z.string().min(1).describe('Job id from a prior extract call')
})

export const extractTextBatchOutputSchema = batchResultSchema(extractResultSchema)

export type ExtractResult = z.infer<typeof extractResultSchema>
export type ExtractTextInput = z.infer<typeof extractTextInputSchema>
export type ExtractTextBatchInput = z.infer<typeof extractTextBatchInputSchema>
export type StatusInput = z.infer<typeof statusInputSchema>

export type DocumentExtractOps = {
	extractText: (input: ExtractTextInput, ctx: ToolContext) => Promise<ExtractResult>
	getStatus: (input: StatusInput, ctx: ToolContext) => Promise<ExtractResult>
	extractTextBatch?: (
		input: ExtractTextBatchInput,
		ctx: ToolContext
	) => Promise<z.infer<typeof extractTextBatchOutputSchema>>
}
