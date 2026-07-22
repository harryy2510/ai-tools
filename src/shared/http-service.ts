/**
 * Shared HTTP transport (ofetch under the hood).
 * Product clients construct this and call query/bytes/get/post/….
 *
 * ofetch handles JSON parse/stringify and Content-Type.
 * We only add: class API, ToolError mapping, noThrow/allowStatuses.
 */

import { createFetch } from 'ofetch'
import type { CreateFetchOptions, FetchOptions } from 'ofetch'
import { trimEnd } from 'es-toolkit'

import type { FetchLike } from '../core/types'
import { assertHttpStatusOk, mapTransportNetworkError } from './transport-errors'

export type HttpServiceOptions = {
	/** Absolute origin or base path. Omit for free-form absolute URLs. */
	baseURL?: string
	/** Default headers (Authorization, Content-Type, …). */
	headers?: Record<string, string>
	/** Default timeout ms. */
	timeout?: number
	/**
	 * Injectable fetch (tests via ToolContext / runTool).
	 * Passed straight to ofetch — no preconnect wrapper.
	 */
	fetch?: FetchLike
	/** Default abort signal. */
	signal?: AbortSignal
	/** Prefix for ToolError messages (e.g. "Resend"). */
	label?: string
}

/**
 * Bodies ofetch accepts. `object` covers plain JSON payloads from tool input
 * (including empty objects); FormData/Blob/string live under BodyInit.
 */
export type HttpBody = BodyInit | object | null

export type HttpCallOptions = {
	query?: Record<string, string | number | boolean | undefined>
	body?: HttpBody
	headers?: Record<string, string>
	/** Status codes returned without throwing. */
	allowStatuses?: readonly number[]
	/** When true, non-2xx is returned instead of throwing. Default false. */
	noThrow?: boolean
	timeout?: number
	signal?: AbortSignal
	/** Override error label for this call. */
	label?: string
}

export type HttpQueryResult = {
	status: number
	ok: boolean
	headers: Headers
	url: string
	/** Parsed body (JSON/text per ofetch). */
	data: unknown
}

export type HttpBytesResult = {
	status: number
	ok: boolean
	headers: Headers
	url: string
	bytes: Uint8Array
}

type OfetchInstance = ReturnType<typeof createFetch>

/**
 * HTTP client: query (parsed), bytes, get/post/put/patch/delete/head.
 * Non-2xx → ToolError by default.
 */
export class HttpService {
	readonly #http: OfetchInstance
	readonly #defaultLabel: string
	readonly #defaultSignal: AbortSignal | undefined

	constructor(options: HttpServiceOptions = {}) {
		this.#defaultLabel = options.label ?? 'HTTP'
		this.#defaultSignal = options.signal
		this.#http = createOfetch(options)
	}

	/** Shared ofetch.raw + status assert + error map. */
	async #raw(method: string, path: string, options: HttpCallOptions, extra?: FetchOptions) {
		const label = options.label ?? this.#defaultLabel
		try {
			const res = await this.#http.raw(path, {
				signal: this.#defaultSignal ?? null,
				method,
				...options,
				...extra
			})
			assertHttpStatusOk(label, res.status, res.headers, options)
			return { status: res.status, ok: res.ok, headers: res.headers, url: res.url, data: res._data }
		} catch (error) {
			mapTransportNetworkError(error, label)
		}
	}

	/** Parsed body (JSON/text). ofetch parses JSON responses by default. */
	async query(method: string, path: string, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.#raw(method, path, options)
	}

	/** Binary body (`responseType: "arrayBuffer"`). ofetch puts ArrayBuffer in `_data`. */
	async bytes(method: string, path: string, options: HttpCallOptions = {}): Promise<HttpBytesResult> {
		const res = await this.#raw(method, path, options, {
			responseType: 'arrayBuffer'
		})
		return {
			...res,
			bytes: new Uint8Array(res.data)
		}
	}

	get(path: string, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('GET', path, options)
	}

	post(path: string, body?: HttpBody, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('POST', path, body === undefined ? options : { ...options, body })
	}

	put(path: string, body?: HttpBody, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('PUT', path, body === undefined ? options : { ...options, body })
	}

	patch(path: string, body?: HttpBody, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('PATCH', path, body === undefined ? options : { ...options, body })
	}

	delete(path: string, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('DELETE', path, options)
	}

	head(path: string, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('HEAD', path, options)
	}
}

function createOfetch(options: HttpServiceOptions): OfetchInstance {
	const defaults: FetchOptions = {
		...options,
		retry: false,
		ignoreResponseError: true
	}
	if (defaults.baseURL) {
		defaults.baseURL = trimEnd(defaults.baseURL, '/')
	}
	const createOptions: CreateFetchOptions = { defaults }
	// Injectable fetch (tests); ofetch types want typeof globalThis.fetch — assign without a preconnect stub.
	if (options.fetch) {
		Object.assign(createOptions, { fetch: options.fetch })
	}
	return createFetch(createOptions)
}
