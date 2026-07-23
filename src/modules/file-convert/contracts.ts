import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'
import {
	transmuteAuthSchema,
	transmuteConvertBatchInputSchema,
	transmuteConvertInputSchema,
	transmuteConvertOutputSchema
} from '../../vendors/transmute'

export const MAX_BATCH_CONVERT = 10

export const transmuteFileConvertAuthSchema = transmuteAuthSchema.extend({
	provider: z.literal('transmute')
})

export type TransmuteFileConvertAuth = z.infer<typeof transmuteFileConvertAuthSchema>

export const fileConvertAuthSchema = z.discriminatedUnion('provider', [transmuteFileConvertAuthSchema])

export type FileConvertAuth = z.infer<typeof fileConvertAuthSchema>

export const convertInputSchema = transmuteConvertInputSchema
export const convertOutputSchema = transmuteConvertOutputSchema
export const convertBatchInputSchema = transmuteConvertBatchInputSchema
export const convertBatchOutputSchema = batchResultSchema(convertOutputSchema)

export type ConvertInput = z.infer<typeof convertInputSchema>
export type ConvertOutput = z.infer<typeof convertOutputSchema>
export type ConvertBatchInput = z.infer<typeof convertBatchInputSchema>
export type ConvertBatchOutput = z.infer<typeof convertBatchOutputSchema>

export type FileConvertOps = {
	convert: (input: ConvertInput) => Promise<ConvertOutput>
	convertBatch: (input: ConvertBatchInput) => Promise<ConvertBatchOutput>
}
