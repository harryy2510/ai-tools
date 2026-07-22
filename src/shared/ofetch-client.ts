/**
 * Legacy free-function HTTP helpers.
 * Prefer `HttpService` (`src/shared/http-service.ts`) for new code.
 */

import type { ToolContext } from '../core/types'
import { HttpService } from './http-service'
import type { HttpCallOptions, HttpQueryResult, HttpBytesResult } from './http-service'
import { omitUndefined } from './omit-undefined'

export type { HttpService, HttpServiceOptions, HttpCallOptions, HttpQueryResult, HttpBytesResult } from './http-service'
export { AwsService } from './aws-service'
export type { AwsCredentials, AwsServiceOptions, AwsCallOptions, AwsQueryResult, AwsBytesResult } from './aws-service'
export { mapTransportNetworkError as mapOfetchError } from './transport-errors'

export type ServiceFetchDefaults = {
	baseURL?: string
	headers?: Record<string, string>
	timeout?: number
	ignoreResponseError?: boolean
}

/** @deprecated Use HttpService; kept for gradual migration. */
export type ServiceHttp = HttpService

export type ServiceRequestOptions = {
	method?: string
	query?: Record<string, string | number | boolean | undefined>
	body?: BodyInit | object | null
	headers?: Record<string, string>
	allowStatuses?: readonly number[]
	throwOnError?: boolean
	timeout?: number
	signal?: AbortSignal
}

export type ServiceJsonResult = HttpQueryResult
export type ServiceBytesResult = HttpBytesResult

/** @deprecated Use `new HttpService({ baseURL, headers, fetch, signal, label })`. */
export function createServiceFetch(defaults: ServiceFetchDefaults, ctx: ToolContext = {}): HttpService {
	return new HttpService(
		omitUndefined({
			baseURL: defaults.baseURL,
			headers: defaults.headers,
			timeout: defaults.timeout,
			fetch: ctx.fetch,
			signal: ctx.signal
		})
	)
}

/** @deprecated Use `http.query` / `http.get` / `http.post` / …. */
export async function serviceRequestJson(
	http: HttpService,
	label: string,
	path: string,
	options: ServiceRequestOptions = {}
): Promise<ServiceJsonResult> {
	return http.query(options.method ?? 'GET', path, toHttpCallOptions(label, options))
}

/** @deprecated Use `http.bytes`. */
export async function serviceRequestBytes(
	http: HttpService,
	label: string,
	path: string,
	options: ServiceRequestOptions = {}
): Promise<ServiceBytesResult> {
	return http.bytes(options.method ?? 'GET', path, toHttpCallOptions(label, options))
}

function toHttpCallOptions(label: string, options: ServiceRequestOptions): HttpCallOptions {
	return omitUndefined({
		label,
		query: options.query,
		body: options.body,
		headers: options.headers,
		allowStatuses: options.allowStatuses,
		timeout: options.timeout,
		signal: options.signal,
		...(options.throwOnError === false ? { noThrow: true as const } : {})
	})
}

/** Encode object key path segments; preserve `/` as path separators. */
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
