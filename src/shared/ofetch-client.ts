import { createFetch, FetchError } from 'ofetch'
import type { CreateFetchOptions, FetchOptions } from 'ofetch'

import { ToolError } from '../core/errors'
import type { FetchLike, ToolContext } from '../core/types'
import { retryAfterMsFromHeader, throwHttpStatus } from './rate-limit'

export type ServiceFetchDefaults = {
	/** Absolute origin or base path. Omit for free-form absolute URLs (web-fetch). */
	baseURL?: string
	/** Host-bound headers (Authorization, apikey, …). Never from tool input. */
	headers?: Record<string, string>
	/** Default timeout ms for requests that do not override. */
	timeout?: number
	/** When true (default), ofetch does not throw on non-2xx; caller checks status. */
	ignoreResponseError?: boolean
}

export type ServiceHttp = ReturnType<typeof createServiceFetch>

export type ServiceRequestOptions = {
	method?: string
	query?: Record<string, string | number | boolean | undefined>
	body?: unknown
	headers?: Record<string, string>
	/** Status codes that are returned without throwing (for example 404 on head). */
	allowStatuses?: readonly number[]
	/** When false, any non-2xx is returned to the caller (web-fetch). Default true. */
	throwOnError?: boolean
	/** Per-request timeout override (ms). */
	timeout?: number
	signal?: AbortSignal
}

export type ServiceJsonResult = {
	status: number
	ok: boolean
	headers: Headers
	/** Final response URL when available (redirects). */
	url: string
	data: unknown
}

export type ServiceBytesResult = {
	status: number
	ok: boolean
	headers: Headers
	url: string
	bytes: Uint8Array
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
 * Fixed-origin (or free-form) ofetch client for one provider/service.
 * Closes host auth headers + ctx signal/fetch. Agent owns retries (retry: false).
 */
export function createServiceFetch(defaults: ServiceFetchDefaults, ctx: ToolContext = {}) {
	const rawFetch: FetchLike | undefined = ctx.fetch ?? globalThis.fetch

	const fetchDefaults: FetchOptions = {
		headers: defaults.headers ?? {},
		retry: false,
		ignoreResponseError: defaults.ignoreResponseError ?? true
	}
	if (defaults.baseURL !== undefined) {
		fetchDefaults.baseURL = defaults.baseURL.replace(/\/+$/, '')
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

/** Map ofetch / network failures to ToolError. */
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

function compactQuery(
	query: Record<string, string | number | boolean | undefined> | undefined
): Record<string, string | number | boolean> | undefined {
	if (query === undefined) return undefined
	const out: Record<string, string | number | boolean> = {}
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined) continue
		out[key] = value
	}
	return Object.keys(out).length === 0 ? undefined : out
}

function assertHttpOk(
	label: string,
	status: number,
	headers: Headers,
	options: { allowStatuses?: readonly number[]; throwOnError?: boolean }
): void {
	if (options.throwOnError === false) return
	if (status >= 200 && status < 300) return
	if (options.allowStatuses !== undefined && options.allowStatuses.includes(status)) return
	if (status === 404) {
		throw new ToolError('Not found', { code: 'not_found', details: { status } })
	}
	throwHttpStatus(label, status, retryAfterMsFromHeader(headers.get('retry-after')))
}

/**
 * JSON-oriented request. Throws ToolError on non-2xx unless allowStatuses.
 * Returns parsed `_data` (ofetch JSON/text handling).
 */
export async function serviceRequestJson(
	http: ServiceHttp,
	label: string,
	path: string,
	options: ServiceRequestOptions = {}
): Promise<ServiceJsonResult> {
	const query = compactQuery(options.query)
	try {
		const res = await http.raw(path, {
			method: options.method ?? 'GET',
			...(query === undefined ? {} : { query }),
			...(options.body === undefined ? {} : { body: options.body }),
			...(options.headers === undefined ? {} : { headers: options.headers }),
			...(options.timeout === undefined ? {} : { timeout: options.timeout }),
			...(options.signal === undefined ? {} : { signal: options.signal })
		})
		assertHttpOk(label, res.status, res.headers, {
			...(options.allowStatuses === undefined ? {} : { allowStatuses: options.allowStatuses }),
			...(options.throwOnError === undefined ? {} : { throwOnError: options.throwOnError })
		})
		return {
			status: res.status,
			ok: res.ok,
			headers: res.headers,
			url: res.url,
			data: res._data
		}
	} catch (error) {
		mapOfetchError(error, label)
	}
}

/** Binary body request (arrayBuffer). */
export async function serviceRequestBytes(
	http: ServiceHttp,
	label: string,
	path: string,
	options: ServiceRequestOptions = {}
): Promise<ServiceBytesResult> {
	const query = compactQuery(options.query)
	try {
		const res = await http.raw(path, {
			method: options.method ?? 'GET',
			responseType: 'arrayBuffer',
			...(query === undefined ? {} : { query }),
			...(options.body === undefined ? {} : { body: options.body }),
			...(options.headers === undefined ? {} : { headers: options.headers }),
			...(options.timeout === undefined ? {} : { timeout: options.timeout }),
			...(options.signal === undefined ? {} : { signal: options.signal })
		})
		assertHttpOk(label, res.status, res.headers, {
			...(options.allowStatuses === undefined ? {} : { allowStatuses: options.allowStatuses }),
			...(options.throwOnError === undefined ? {} : { throwOnError: options.throwOnError })
		})
		const data: unknown = res._data
		let bytes: Uint8Array | undefined
		if (data instanceof ArrayBuffer) {
			bytes = new Uint8Array(data)
		} else if (ArrayBuffer.isView(data)) {
			bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
		}
		if (bytes === undefined) {
			// Empty allowed body on some DELETEs / 204
			if (res.status === 204 || res.status === 205) {
				bytes = new Uint8Array(0)
			} else if (options.allowStatuses !== undefined && options.allowStatuses.includes(res.status)) {
				bytes = new Uint8Array(0)
			} else if (options.throwOnError === false) {
				bytes = new Uint8Array(0)
			} else {
				throw new ToolError(`${label} returned non-binary body`, { code: 'upstream' })
			}
		}
		return {
			status: res.status,
			ok: res.ok,
			headers: res.headers,
			url: res.url,
			bytes
		}
	} catch (error) {
		mapOfetchError(error, label)
	}
}

/** Encode object key path segments; preserve `/` as path separators (S3/R2/Supabase style). */
export function encodeObjectKeyPath(key: string): string {
	return key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const bodyBuffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(bodyBuffer).set(bytes)
	return bodyBuffer
}
