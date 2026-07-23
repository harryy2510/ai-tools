import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'
import {
	MAX_BATCH_EXTRACT,
	textractAuthSchema,
	textractExtractResultSchema,
	textractExtractTextBatchInputSchema,
	textractExtractTextInputSchema,
	textractStatusInputSchema
} from '../../vendors/textract'
import type {
	TextractExtractResult,
	TextractExtractTextBatchInput,
	TextractExtractTextInput,
	TextractStatusInput
} from '../../vendors/textract'

export { MAX_BATCH_EXTRACT }

/** Host auth: vendor credentials + provider discriminator. */
export const textractDocumentExtractAuthSchema = textractAuthSchema.extend({
	provider: z.literal('textract')
})

export type TextractDocumentExtractAuth = z.infer<typeof textractDocumentExtractAuthSchema>

export const documentExtractAuthSchema = z.discriminatedUnion('provider', [textractDocumentExtractAuthSchema])

export type DocumentExtractAuth = z.infer<typeof documentExtractAuthSchema>

/** Capability I/O — same shapes as Textract today. */
export const extractResultSchema = textractExtractResultSchema
export const extractTextInputSchema = textractExtractTextInputSchema
export const extractTextBatchInputSchema = textractExtractTextBatchInputSchema
export const statusInputSchema = textractStatusInputSchema
export const extractTextBatchOutputSchema = batchResultSchema(extractResultSchema)

export type ExtractResult = TextractExtractResult
export type ExtractTextInput = TextractExtractTextInput
export type ExtractTextBatchInput = TextractExtractTextBatchInput
export type StatusInput = TextractStatusInput
export type ExtractTextBatchOutput = z.infer<typeof extractTextBatchOutputSchema>

/** Shared seam surface — provider classes implement this. */
export type DocumentExtractOps = {
	extractText: (input: ExtractTextInput) => Promise<ExtractResult>
	getStatus: (input: StatusInput) => Promise<ExtractResult>
	extractTextBatch: (input: ExtractTextBatchInput) => Promise<ExtractTextBatchOutput>
}
