import { z } from 'zod'

/** Agent-facing list page envelope (one page per tool call). */
export function listPageInputSchema(options?: { maxLimit?: number; defaultDescribe?: string }) {
	const maxLimit = options?.maxLimit ?? 1000
	return z.object({
		cursor: z.string().min(1).optional().describe('Opaque pagination cursor from a prior page'),
		limit: z
			.int()
			.min(1)
			.max(maxLimit)
			.optional()
			.describe(options?.defaultDescribe ?? `Maximum items to return (1-${maxLimit})`)
	})
}

export function listPageOutputSchema<T extends z.ZodType>(itemSchema: T) {
	return z.object({
		items: z.array(itemSchema),
		next_cursor: z.string().optional().describe('Pass as cursor to fetch the next page'),
		truncated: z.boolean().describe('Whether more results may exist')
	})
}
