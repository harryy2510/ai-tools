import { isNil, isString } from 'es-toolkit'
import { castArray } from 'es-toolkit/compat'

import type { NamedAddress } from './schemas'

/** RFC-ish string form for APIs that want a single string address (e.g. Resend). */
export function addressToString(item: NamedAddress): string {
	if (isString(item)) return item
	return !item.name ? item.email : `${item.name} <${item.email}>`
}

export function addressList(value: NamedAddress | NamedAddress[] | undefined): string[] | undefined {
	if (isNil(value)) return undefined
	return castArray(value).map(addressToString)
}

/** Object form for APIs that accept string | { email, name } (e.g. Cloudflare). */
export function addressObject(item: NamedAddress): string | { email: string; name?: string } {
	if (isString(item)) return item
	return { email: item.email, ...(item.name && { name: item.name }) }
}

export function addressObjectList(
	value: NamedAddress | NamedAddress[] | undefined
): Array<string | { email: string; name?: string }> | undefined {
	if (isNil(value)) return undefined
	return castArray(value).map(addressObject)
}

export function recipientCount(value: NamedAddress | NamedAddress[] | undefined): number {
	if (isNil(value)) return 0
	return castArray(value).length
}
