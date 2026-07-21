import { ToolError } from '../core/errors'
import type { FetchLike, ToolContext } from '../core/types'

export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export type HttpRequestOptions = {
	baseUrl: string
	body?: unknown
	headers?: Record<string, string>
	method: HttpMethod
	path: string
	query?: Record<string, string | number | boolean | undefined>
	signal?: AbortSignal
	timeoutMs?: number
	fetchImpl?: FetchLike
}

function joinUrl(baseUrl: string, path: string): string {
	const base = baseUrl.replace(/\/+$/, '')
	const suffix = path.startsWith('/') ? path : `/${path}`
	return `${base}${suffix}`
}

function withQuery(url: string, query: HttpRequestOptions['query']): string {
	if (!query) return url
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined) continue
		params.set(key, String(value))
	}
	const qs = params.toString()
	return qs ? `${url}?${qs}` : url
}

export async function httpRequest(
	options: HttpRequestOptions,
	ctx: ToolContext = {}
): Promise<{ data: unknown; status: number }> {
	const fetchImpl = options.fetchImpl ?? ctx.fetch ?? globalThis.fetch
	if (!fetchImpl) {
		throw new ToolError('fetch is not available in this runtime', { code: 'unsupported_runtime' })
	}

	const url = withQuery(joinUrl(options.baseUrl, options.path), options.query)
	const timeoutMs = options.timeoutMs ?? 30_000
	const controller = new AbortController()
	const parentSignals = [options.signal, ctx.signal].filter((signal): signal is AbortSignal => signal !== undefined)

	const onAbort = () => controller.abort()
	for (const signal of parentSignals) {
		if (signal.aborted) controller.abort()
		else signal.addEventListener('abort', onAbort, { once: true })
	}

	const timer = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const hasJsonBody = options.body !== undefined && options.method !== 'GET'
		const init: RequestInit = {
			method: options.method,
			headers: {
				Accept: 'application/json',
				...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
				...options.headers
			},
			signal: controller.signal
		}
		if (hasJsonBody) {
			init.body = JSON.stringify(options.body)
		}

		const response = await fetchImpl(url, init)

		const text = await response.text()
		let data: unknown
		if (text) {
			try {
				const parsed: unknown = JSON.parse(text)
				data = parsed
			} catch {
				data = text
			}
		}

		if (!response.ok) {
			const retryable = response.status === 429 || response.status >= 500
			const code =
				response.status === 401
					? 'bad_auth'
					: response.status === 403
						? 'forbidden'
						: response.status === 404
							? 'not_found'
							: response.status === 429
								? 'rate_limited'
								: 'upstream'

			throw new ToolError(`HTTP ${response.status} from ${options.method} ${options.path}`, {
				code,
				retryable,
				details: { status: response.status }
			})
		}

		return { data, status: response.status }
	} catch (error) {
		if (error instanceof ToolError) throw error
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ToolError('Request timed out or was aborted', {
				code: 'timeout',
				retryable: true,
				cause: error
			})
		}
		throw new ToolError('Upstream request failed', {
			code: 'upstream',
			retryable: true,
			cause: error
		})
	} finally {
		clearTimeout(timer)
		for (const signal of parentSignals) {
			signal.removeEventListener('abort', onAbort)
		}
	}
}
