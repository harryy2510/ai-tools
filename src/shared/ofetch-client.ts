import { createFetch, FetchError } from 'ofetch'
import type { CreateFetchOptions, FetchOptions } from 'ofetch'

import { ToolError } from '../core/errors'
import type { FetchLike, ToolContext } from '../core/types'
import { retryAfterMsFromHeader, throwHttpStatus } from './rate-limit'

export type ServiceFetchDefaults = {
	/** Absolute origin or base path (no trailing slash required). */
	baseURL: string
	/** Host-bound headers (Authorization, apikey, …). Never from tool input. */
	headers?: Record<string, string>
	/** Default timeout ms for requests that do not override. */
	timeout?: number
	/** When true (default), ofetch does not throw on non-2xx; caller checks status. */
	ignoreResponseError?: boolean
}

/** Adapt injectable FetchLike to ofetch's typeof fetch (includes preconnect). */
export function bindFetch(fetchImpl: FetchLike): typeof globalThis.fetch {
	function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		return fetchImpl(input, init)
	}
	fetch.preconnect = (url: string | URL, options?: Parameters<typeof globalThis.fetch.preconnect>[1]): void => {
		if (typeof globalThis.fetch.preconnect === 'function') {
			globalThis.fetch.preconnect(url, options)
		}
	}
	return fetch
}

/**
 * Fixed-origin ofetch client for one provider/service.
 * Closes host auth headers + ctx signal/fetch. Agent owns retries (retry: false).
 */
export function createServiceFetch(defaults: ServiceFetchDefaults, ctx: ToolContext = {}) {
	const rawFetch: FetchLike | undefined = ctx.fetch ?? globalThis.fetch

	const fetchDefaults: FetchOptions = {
		baseURL: defaults.baseURL.replace(/\/+$/, ''),
		headers: defaults.headers ?? {},
		retry: false,
		ignoreResponseError: defaults.ignoreResponseError ?? true
	}
	if (defaults.timeout !== undefined) {
		fetchDefaults.timeout = defaults.timeout
	}
	if (ctx.signal !== undefined) {
		fetchDefaults.signal = ctx.signal
	}

	const options: CreateFetchOptions = {
		defaults: fetchDefaults
	}
	if (rawFetch !== undefined) {
		options.fetch = bindFetch(rawFetch)
	}

	return createFetch(options)
}

/** Map ofetch / network failures to ToolError. Non-2xx with ignoreResponseError are caller-handled. */
export function mapOfetchError(error: unknown, label: string): never {
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
