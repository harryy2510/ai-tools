/**
 * Web-fetch client — allowlisted HTTP via HttpService.
 * Host: withAuth + fromContext. Tools stay thin adapters.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { mapTransportNetworkError } from '../../transport/errors'
import type { HttpBody } from '../../transport/http-service'
import { HttpService } from '../../transport/http-service'
import { DEFAULT_TIMEOUT_MS, webFetchAuthSchema, webFetchRequestOutputSchema } from './contracts'
import type { WebFetchAuth, WebFetchGetInput, WebFetchRequestInput, WebFetchRequestOutput } from './contracts'
import {
	assertAllowed,
	assertHttpsOrigins,
	allowedOriginSet,
	headersForRequest,
	modelHeaders,
	requestBody
} from './domain'

export type WebFetchClientOptions = {
	fetch?: ToolContext['fetch']
	signal?: ToolContext['signal']
}

type ExecuteArgs = {
	url: string
	method: string
	headers?: Record<string, string>
	query?: Record<string, string | number | boolean>
	body?: HttpBody
	timeout_ms?: number
}

export class WebFetchClient {
	readonly #auth: WebFetchAuth
	readonly #options: WebFetchClientOptions

	constructor(auth: WebFetchAuth, options: WebFetchClientOptions = {}) {
		const parsed = webFetchAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Web fetch host binding is missing or invalid', { code: 'bad_auth' })
		}
		this.#auth = parsed.data
		this.#options = options
	}

	static fromContext(ctx: ToolContext): WebFetchClient {
		const auth = requireAuth(ctx, webFetchAuthSchema)
		return new WebFetchClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	static fromAuth(auth: WebFetchAuth, ctx: ToolContext = {}): WebFetchClient {
		return new WebFetchClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	get(input: WebFetchGetInput): Promise<WebFetchRequestOutput> {
		return this.#execute({
			url: input.url,
			method: input.method ?? 'GET',
			...(input.headers && { headers: input.headers }),
			...(input.query && { query: input.query }),
			...(input.timeout_ms !== undefined && { timeout_ms: input.timeout_ms })
		})
	}

	request(input: WebFetchRequestInput): Promise<WebFetchRequestOutput> {
		return this.#execute({
			url: input.url,
			method: input.method ?? 'POST',
			...(input.headers && { headers: input.headers }),
			...(input.query && { query: input.query }),
			...(input.body !== undefined && { body: requestBody(input.body) }),
			...(input.timeout_ms !== undefined && { timeout_ms: input.timeout_ms })
		})
	}

	async #execute(input: ExecuteArgs): Promise<WebFetchRequestOutput> {
		const auth = this.#auth
		const requireHttps = auth.require_https === true
		const allowed = allowedOriginSet(auth.allowed_origins)
		assertHttpsOrigins(allowed, requireHttps)

		const target = assertAllowed(input.url, allowed, requireHttps)
		const method = input.method
		const timeout = input.timeout_ms ?? auth.timeout_ms ?? DEFAULT_TIMEOUT_MS
		const http = new HttpService({
			timeout,
			label: 'Web fetch',
			...(this.#options.fetch && { fetch: this.#options.fetch }),
			...(this.#options.signal && { signal: this.#options.signal })
		})

		try {
			const response = await http.query(method, target.href, {
				headers: headersForRequest(auth.default_headers, modelHeaders(input.headers)),
				...(input.query && { query: input.query }),
				...(input.body !== undefined && { body: input.body }),
				timeout,
				noThrow: true
			})

			const finalUrl = response.url.length > 0 ? response.url : target.href
			assertAllowed(finalUrl, allowed, requireHttps)

			const contentType = response.headers.get('content-type') ?? undefined
			const headers: Record<string, string> = {}
			response.headers.forEach((value, key) => {
				headers[key.toLowerCase()] = value
			})

			return webFetchRequestOutputSchema.parse({
				url: finalUrl,
				status: response.status,
				ok: response.ok,
				headers,
				...(contentType && { content_type: contentType }),
				body: method === 'HEAD' ? null : response.data
			})
		} catch (error) {
			mapTransportNetworkError(error, 'Web fetch')
		}
	}
}
