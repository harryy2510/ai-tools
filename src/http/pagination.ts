/**
 * Shared pagination helpers for fixed HTTP modules (not agent-facing tools).
 * Host modules compose these inside action `mapResponse` / multi-page loops.
 */

export type PageResult<TItem> = {
	items: TItem[]
	nextCursor?: string
	nextPage?: number
}

export function mergePages<TItem>(pages: ReadonlyArray<PageResult<TItem>>): TItem[] {
	const items: TItem[] = []
	for (const page of pages) {
		items.push(...page.items)
	}
	return items
}

export type CollectPagesOptions<TItem> = {
	/** Hard cap on pages fetched (fail or stop — caller decides after). */
	maxPages: number
	/** Hard cap on total items. */
	maxItems: number
	fetchPage: (cursor: { cursor?: string; page: number }) => Promise<PageResult<TItem>>
}

/**
 * Walk cursor/page pagination until exhausted or limits hit.
 * Does not invent vendor semantics; caller supplies nextCursor/nextPage.
 */
export async function collectPages<TItem>(
	options: CollectPagesOptions<TItem>
): Promise<{ items: TItem[]; pages: number; truncated: boolean }> {
	const items: TItem[] = []
	let page = 1
	let cursor: string | undefined
	let truncated = false

	while (page <= options.maxPages) {
		const result = await options.fetchPage({
			page,
			...(cursor === undefined ? {} : { cursor })
		})
		for (const item of result.items) {
			if (items.length >= options.maxItems) {
				truncated = true
				return { items, pages: page, truncated }
			}
			items.push(item)
		}

		if (result.nextCursor) {
			cursor = result.nextCursor
			page += 1
			continue
		}
		if (typeof result.nextPage === 'number' && result.nextPage > page) {
			page = result.nextPage
			cursor = undefined
			continue
		}
		break
	}

	if (page > options.maxPages) {
		truncated = true
	}

	return { items, pages: Math.min(page, options.maxPages), truncated }
}
