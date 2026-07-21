import { z } from 'zod'

import { isToolError, ToolError } from '../core/errors'

export const batchItemErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
	retryable: z.boolean().optional()
})

export type BatchItemError = z.infer<typeof batchItemErrorSchema>

export type BatchItemResult<TValue> = {
	index: number
	ok: boolean
	value?: TValue
	error?: BatchItemError
}

export type BatchResult<TValue> = {
	results: Array<BatchItemResult<TValue>>
	succeeded: number
	failed: number
}

export function batchResultSchema<T extends z.ZodType>(valueSchema: T) {
	return z.object({
		results: z.array(
			z.object({
				index: z.int(),
				ok: z.boolean(),
				value: valueSchema.optional(),
				error: batchItemErrorSchema.optional()
			})
		),
		succeeded: z.int(),
		failed: z.int()
	})
}

/** Run items sequentially; partial failures do not stop the batch. */
export async function runBatchItems<TIn, TOut>(
	items: readonly TIn[],
	runOne: (item: TIn, index: number) => Promise<TOut>
): Promise<BatchResult<TOut>> {
	const results: Array<BatchItemResult<TOut>> = []
	let succeeded = 0
	let failed = 0

	for (let index = 0; index < items.length; index += 1) {
		const item = items[index]
		if (item === undefined) continue
		try {
			const value = await runOne(item, index)
			results.push({ index, ok: true, value })
			succeeded += 1
		} catch (error) {
			const toolError =
				error instanceof ToolError
					? error
					: isToolError(error)
						? error
						: new ToolError(error instanceof Error ? error.message : 'Batch item failed', {
								code: 'internal',
								cause: error
							})
			results.push({
				index,
				ok: false,
				error: {
					code: toolError.code,
					message: toolError.message,
					...(toolError.retryable ? { retryable: true } : {})
				}
			})
			failed += 1
		}
	}

	return { results, succeeded, failed }
}
