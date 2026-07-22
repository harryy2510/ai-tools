import { isError, sumBy } from 'es-toolkit'
import pMap from 'p-map'
import pRetry from 'p-retry'
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

export type RunBatchItemsOptions = {
	/** Default 1 (sequential). */
	concurrency?: number
	/** Extra attempts; only `ToolError.retryable`. Default 0. */
	retries?: number
}

/** p-map + optional p-retry. Partial failures do not abort the batch. */
export async function runBatchItems<TIn, TOut>(
	items: readonly TIn[],
	runOne: (item: TIn, index: number) => Promise<TOut>,
	{ concurrency = 1, retries = 0 }: RunBatchItemsOptions = {}
): Promise<BatchResult<TOut>> {
	const results = await pMap(
		items,
		async (item, index): Promise<BatchItemResult<TOut>> => {
			try {
				const run = () => runOne(item, index)
				const value =
					retries === 0
						? await run()
						: await pRetry(run, {
								retries,
								minTimeout: 250,
								shouldRetry: ({ error }) => isToolError(error) && error.retryable
							})
				return { index, ok: true, value }
			} catch (error) {
				const err =
					error instanceof ToolError
						? error
						: new ToolError(isError(error) ? error.message : 'Batch item failed', {
								code: 'internal',
								cause: error
							})
				return {
					index,
					ok: false,
					error: { code: err.code, message: err.message, retryable: err.retryable }
				}
			}
		},
		{ concurrency, stopOnError: false }
	)

	const succeeded = sumBy(results, (r) => (r.ok ? 1 : 0))
	return { results, succeeded, failed: results.length - succeeded }
}
