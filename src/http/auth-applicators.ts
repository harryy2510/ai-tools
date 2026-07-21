import type { ToolContext } from '../core/types'

export type AuthHeaders = { headers?: Record<string, string> }

/** Bearer token from `{ token: string }`. */
export function applyBearerAuth(auth: unknown, _ctx?: ToolContext): AuthHeaders {
	if (typeof auth !== 'object' || auth === null || !('token' in auth)) return {}
	const token = auth.token
	if (typeof token !== 'string' || token.length === 0) return {}
	return { headers: { Authorization: `Bearer ${token}` } }
}

/** API key header from `{ apiKey: string }` (default header `X-Api-Key`). */
export function applyApiKeyHeader(auth: unknown, options: { headerName?: string } = {}): AuthHeaders {
	if (typeof auth !== 'object' || auth === null || !('apiKey' in auth)) return {}
	const apiKey = auth.apiKey
	if (typeof apiKey !== 'string' || apiKey.length === 0) return {}
	const headerName = options.headerName ?? 'X-Api-Key'
	return { headers: { [headerName]: apiKey } }
}

/** HTTP Basic from `{ username: string; password: string }`. */
export function applyBasicAuth(auth: unknown, _ctx?: ToolContext): AuthHeaders {
	if (typeof auth !== 'object' || auth === null) return {}
	if (!('username' in auth) || !('password' in auth)) return {}
	const username = auth.username
	const password = auth.password
	if (typeof username !== 'string' || typeof password !== 'string') return {}
	const encoded = btoa(`${username}:${password}`)
	return { headers: { Authorization: `Basic ${encoded}` } }
}
