import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { batchResultSchema } from '../../shared/batch'
import { s3AuthSchema } from '../s3'

export const MAX_BATCH_CONVERT = 10

export const transmuteAuthSchema = z.object({
	transmute_base_url: z.url().describe('Self-hosted Transmute origin, for example http://localhost:3313'),
	transmute_token: z.string().min(1).describe('Transmute Bearer token (API key or JWT)'),
	storage: s3AuthSchema.describe('Object storage credentials for artifact IO')
})

export type TransmuteAuth = z.infer<typeof transmuteAuthSchema>

export const transmuteConvertInputSchema = z.object({
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

export const transmuteConvertOutputSchema = z.object({
	source: artifactRefSchema,
	result: artifactRefSchema,
	provider_source_id: z.string().optional().describe('Transmute source file id when known'),
	provider_result_id: z.string().optional().describe('Transmute result file id when known')
})

export const transmuteConvertBatchInputSchema = z.object({
	items: z.array(transmuteConvertInputSchema).min(1).max(MAX_BATCH_CONVERT).describe('Conversions to run (max 10)')
})

export const transmuteConvertBatchOutputSchema = batchResultSchema(transmuteConvertOutputSchema)

export type TransmuteConvertInput = z.infer<typeof transmuteConvertInputSchema>
export type TransmuteConvertOutput = z.infer<typeof transmuteConvertOutputSchema>
export type TransmuteConvertBatchInput = z.infer<typeof transmuteConvertBatchInputSchema>
export type TransmuteConvertBatchOutput = z.infer<typeof transmuteConvertBatchOutputSchema>
