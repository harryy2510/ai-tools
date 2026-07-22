import { isUndefined, omitBy } from 'es-toolkit'

/**
 * Shallow copy of `obj` without keys whose value is `undefined`.
 * Useful under exactOptionalPropertyTypes when building option bags.
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
	return omitBy(obj, isUndefined)
}
