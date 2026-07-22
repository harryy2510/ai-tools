import { countBy, pickBy } from 'es-toolkit'

/** Keys that appear more than once (via `by`). */
export function duplicatesBy<T>(items: readonly T[], by: (item: T) => string): string[] {
	return Object.keys(pickBy(countBy(items, by), (n) => n > 1))
}

/** First duplicate key, if any. */
export function firstDuplicateBy<T>(items: readonly T[], by: (item: T) => string): string | undefined {
	return duplicatesBy(items, by)[0]
}

/** Throw if any key from `by` is duplicated. */
export function assertUniqueBy<T>(
	items: readonly T[],
	by: (item: T) => string,
	message: (duplicate: string) => string
): void {
	const duplicate = firstDuplicateBy(items, by)
	if (duplicate !== undefined) throw new Error(message(duplicate))
}
