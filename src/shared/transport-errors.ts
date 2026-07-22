/**
 * Shared HTTP status / network → ToolError mapping for HttpService and AwsService.
 */

import { FetchError } from 'ofetch'

import { ToolError } from '../core/errors'
import { retryAfterMsFromHeader, throwHttpStatus } from './rate-limit'

export type StatusThrowOptions = {
	allowStatuses?: readonly number[]
	/** When true, non-2xx does not throw. */
	noThrow?: boolean
}

/** Default: throw ToolError on non-2xx (404 → not_found). */
export function assertHttpStatusOk(
	label: string,
	status: number,
	headers: Headers,
	options: StatusThrowOptions = {}
): void {
	if (options.noThrow === true) return
	if (status >= 200 && status < 300) return
	if (options.allowStatuses !== undefined && options.allowStatuses.includes(status)) return
	if (status === 404) {
		throw new ToolError('Not found', { code: 'not_found', details: { status } })
	}
	throwHttpStatus(label, status, retryAfterMsFromHeader(headers.get('retry-after')))
}

/** Map ofetch / AbortError / unknown network failures to ToolError. */
export function mapTransportNetworkError(error: unknown, label: string): never {
	if (error instanceof ToolError) throw error
	if (error instanceof FetchError) {
		const status = error.statusCode ?? error.response?.status
		if (typeof status === 'number' && Number.isFinite(status)) {
			const retryAfter = retryAfterMsFromHeader(error.response?.headers.get('retry-after') ?? null)
			throwHttpStatus(label, status, retryAfter)
		}
		throw new ToolError(error.message || `${label} request failed`, {
			code: 'upstream',
			retryable: true,
			cause: error
		})
	}
	if (error instanceof Error && error.name === 'AbortError') {
		throw new ToolError(`${label} request was aborted`, {
			code: 'timeout',
			retryable: true,
			cause: error
		})
	}
	throw new ToolError(`${label} request failed`, {
		code: 'upstream',
		retryable: true,
		cause: error
	})
}
