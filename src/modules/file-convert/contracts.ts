import { z } from 'zod'

import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import { batchResultSchema } from '../../shared/batch'

export const MAX_BATCH_CONVERT = 10

export const convertInputSchema = z.object({
	source: artifactRefSchema.describe('Input artifact (store must be object)'),
	output_format: z.string().min(1).describe('Target format extension, for example pdf, png, md'),
	output_key: z
		.string()
		.min(1)
		.optional()
		.describe('Object key for the result. Defaults to source key with new extension'),
	quality: z.string().min(1).optional().describe('Optional conversion quality hint'),
	filename: z.string().min(1).optional().describe('Filename for upload when source has none')
})

export const convertOutputSchema = z.object({
	source: artifactRefSchema,
	result: artifactRefSchema,
	provider_source_id: z.string().optional(),
	provider_result_id: z.string().optional()
})

export const convertBatchInputSchema = z.object({
	items: z.array(convertInputSchema).min(1).max(MAX_BATCH_CONVERT).describe('Conversions to run (max 10)')
})

export const convertBatchOutputSchema = batchResultSchema(convertOutputSchema)

export type ConvertInput = z.infer<typeof convertInputSchema>
export type ConvertOutput = z.infer<typeof convertOutputSchema>
export type ConvertBatchInput = z.infer<typeof convertBatchInputSchema>

export type FileConvertOps = {
	convert: (input: ConvertInput, ctx: ToolContext) => Promise<ConvertOutput>
	convertBatch?: (input: ConvertBatchInput, ctx: ToolContext) => Promise<z.infer<typeof convertBatchOutputSchema>>
}
