import { ToolError } from '../core/errors'
import type { ToolErrorCode } from '../core/errors'

/** Map common HTTP status codes to stable ToolError codes. */
export function httpErrorCode(status: number): ToolErrorCode {
	if (status === 401) return 'bad_auth'
	if (status === 403) return 'forbidden'
	if (status === 404) return 'not_found'
	if (status === 429) return 'rate_limited'
	if (status === 413) return 'too_large'
	return 'upstream'
}

export function throwHttpStatus(operation: string, status: number, retryAfterMs?: number): never {
	const code = httpErrorCode(status)
	throw new ToolError(`${operation} failed with HTTP ${status}`, {
		code,
		retryable: status >= 500 || status === 429,
		details: {
			status,
			...(retryAfterMs === undefined ? {} : { retry_after_ms: retryAfterMs })
		}
	})
}

/** Parse Retry-After header (seconds or HTTP-date) into milliseconds when possible. */
export function retryAfterMsFromHeader(value: string | null): number | undefined {
	if (value === null || value.length === 0) return undefined
	const asSeconds = Number.parseInt(value, 10)
	if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000
	const asDate = Date.parse(value)
	if (Number.isFinite(asDate)) {
		const delta = asDate - Date.now()
		return delta > 0 ? delta : 0
	}
	return undefined
}
