/**
 * Web-fetch policy: allowlist origins, block credential headers, normalize bodies.
 */

import { ToolError } from '../../core/errors'
import type { HttpBody } from '../../transport/http-service'

/** Only credentials / identity headers the model must not set. */
export const BLOCKED_MODEL_HEADERS = new Set([
	'authorization',
	'proxy-authorization',
	'cookie',
	'cookie2',
	'x-api-key',
	'x-auth-token',
	'x-access-token',
	'api-key'
])

export function requestBody(body: unknown): HttpBody {
	if (body === null) return null
	if (typeof body === 'string' || typeof body === 'object') return body
	throw new ToolError('Request body must be a string, object, array, or null', { code: 'bad_input' })
}

export function originOf(value: string, kind: 'bad_auth' | 'bad_input'): string {
	let url: URL
	try {
		url = new URL(value)
	} catch {
		throw new ToolError(kind === 'bad_auth' ? `Invalid allowed origin: ${value}` : 'Invalid URL', {
			code: kind
		})
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new ToolError('Only http and https are allowed', { code: kind === 'bad_auth' ? 'bad_auth' : 'forbidden' })
	}
	if (url.username !== '' || url.password !== '') {
		throw new ToolError(
			kind === 'bad_auth' ? 'Allowed origins must not include credentials' : 'URL must not include credentials',
			{ code: kind }
		)
	}
	return url.origin
}

export function assertAllowed(url: string, allowed: Set<string>, requireHttps: boolean): URL {
	const parsed = new URL(url)
	if (requireHttps && parsed.protocol !== 'https:') {
		throw new ToolError('HTTPS is required for this binding', { code: 'forbidden' })
	}
	if (parsed.username !== '' || parsed.password !== '') {
		throw new ToolError('URL must not include credentials', { code: 'bad_input' })
	}
	if (!allowed.has(parsed.origin)) {
		throw new ToolError(`Origin not in allowlist: ${parsed.origin}`, {
			code: 'forbidden',
			details: { origin: parsed.origin }
		})
	}
	return parsed
}

export function modelHeaders(headers: Record<string, string> | undefined): Record<string, string> {
	if (!headers) return {}
	const out: Record<string, string> = {}
	for (const [key, value] of Object.entries(headers)) {
		const name = key.trim()
		if (name.length === 0) continue
		if (BLOCKED_MODEL_HEADERS.has(name.toLowerCase())) {
			throw new ToolError(`Request header is not allowed from the model: ${name}`, {
				code: 'bad_input',
				details: { header: name }
			})
		}
		out[name] = value
	}
	return out
}

export function headersForRequest(
	hostDefaults: Record<string, string> | undefined,
	model: Record<string, string>
): Record<string, string> {
	return { ...model, ...hostDefaults }
}

export function allowedOriginSet(allowedOrigins: string[]): Set<string> {
	return new Set(allowedOrigins.map((o) => originOf(o, 'bad_auth')))
}

export function assertHttpsOrigins(allowed: Set<string>, requireHttps: boolean): void {
	if (!requireHttps) return
	for (const origin of allowed) {
		if (!origin.startsWith('https:')) {
			throw new ToolError(`require_https is set; origin must be https: ${origin}`, {
				code: 'bad_auth'
			})
		}
	}
}
