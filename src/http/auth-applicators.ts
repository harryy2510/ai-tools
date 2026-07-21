import { isPlainObject, isString } from 'es-toolkit'
import { has } from 'es-toolkit/compat'

import type { ToolContext } from '../core/types'

export type AuthHeaders = { headers?: Record<string, string> }

function stringField(auth: unknown, key: string): string | undefined {
	if (!isPlainObject(auth) || !has(auth, key)) return undefined
	const value = auth[key]
	return isString(value) && value.length > 0 ? value : undefined
}

/** Bearer token from `{ token: string }`. */
export function applyBearerAuth(auth: unknown, _ctx?: ToolContext): AuthHeaders {
	const token = stringField(auth, 'token')
	if (token === undefined) return {}
	return { headers: { Authorization: `Bearer ${token}` } }
}

/** API key header from `{ apiKey: string }` (default header `X-Api-Key`). */
export function applyApiKeyHeader(auth: unknown, options: { headerName?: string } = {}): AuthHeaders {
	const apiKey = stringField(auth, 'apiKey')
	if (apiKey === undefined) return {}
	const headerName = options.headerName ?? 'X-Api-Key'
	return { headers: { [headerName]: apiKey } }
}

/** HTTP Basic from `{ username: string; password: string }`. */
export function applyBasicAuth(auth: unknown, _ctx?: ToolContext): AuthHeaders {
	const username = stringField(auth, 'username')
	const password = stringField(auth, 'password')
	if (username === undefined || password === undefined) return {}
	return { headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` } }
}
