import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import type { ToolContext } from '../../core/types'
import { createServiceFetch, mapOfetchError, serviceRequestJson } from '../../shared/ofetch-client'

const DEFAULT_TIMEOUT_MS = 30_000

/** Only credentials / identity headers the model must not set. */
const BLOCKED_MODEL_HEADERS = new Set([
	'authorization',
	'proxy-authorization',
	'cookie',
	'cookie2',
	'x-api-key',
	'x-auth-token',
	'x-access-token',
	'api-key'
])

export const webFetchAuthSchema = z.object({
	allowed_origins: z
		.array(z.string().min(1))
		.min(1)
		.max(64)
		.describe('Exact origins permitted, for example https://api.example.com'),
	default_headers: z
		.record(z.string(), z.string())
		.optional()
		.describe('Host-injected headers (for example Authorization). Not tool inputs'),
	require_https: z.boolean().optional().describe('When true, only https URLs. Defaults to false'),
	timeout_ms: z.int().min(1).max(120_000).optional().describe('Default timeout ms (default 30000)')
})

export type WebFetchAuth = z.infer<typeof webFetchAuthSchema>

const sharedFields = {
	url: z.url().describe('Absolute http(s) URL on an allowlisted origin'),
	headers: z.record(z.string(), z.string()).optional().describe('Extra headers (no credentials)'),
	query: z
		.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
		.optional()
		.describe('Query parameters'),
	timeout_ms: z.int().min(1).max(120_000).optional().describe('Per-request timeout override')
}

const getInputSchema = z.object({
	...sharedFields,
	method: z.enum(['GET', 'HEAD']).optional().describe('Read method. Defaults to GET')
})

const mutateInputSchema = z.object({
	...sharedFields,
	method: z.enum(['POST', 'PUT', 'PATCH', 'DELETE']).optional().describe('Mutating method. Defaults to POST'),
	body: z
		.unknown()
		.optional()
		.describe(
			'Request body. Objects and arrays are sent as JSON with Content-Type set by ofetch; strings are raw text. Omit for DELETE when unused'
		)
})

const requestOutputSchema = z.object({
	url: z.string(),
	status: z.int(),
	ok: z.boolean(),
	headers: z.record(z.string(), z.string()),
	content_type: z.string().optional(),
	/** ofetch-parsed payload: object/array for JSON, string for text, etc. */
	body: z.unknown()
})

type ExecuteArgs = {
	url: string
	method: string
	headers?: Record<string, string>
	query?: Record<string, string | number | boolean>
	body?: unknown
	timeout_ms?: number
}

function readAuth(ctx: ToolContext): WebFetchAuth {
	const parsed = webFetchAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('Web fetch host binding is missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function originOf(value: string, kind: 'bad_auth' | 'bad_input'): string {
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

function assertAllowed(url: string, allowed: Set<string>, requireHttps: boolean): URL {
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

function modelHeaders(headers: Record<string, string> | undefined): Record<string, string> {
	if (headers === undefined) return {}
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

function headersForRequest(
	hostDefaults: Record<string, string> | undefined,
	model: Record<string, string>
): Record<string, string> {
	return { ...model, ...hostDefaults }
}

function createWebFetchService(ctx: ToolContext, timeoutMs: number) {
	return createServiceFetch({ timeout: timeoutMs }, ctx)
}

async function executeHttp(input: ExecuteArgs, ctx: ToolContext): Promise<z.infer<typeof requestOutputSchema>> {
	const auth = readAuth(ctx)
	const requireHttps = auth.require_https === true
	const allowed = new Set(auth.allowed_origins.map((o) => originOf(o, 'bad_auth')))
	if (requireHttps) {
		for (const origin of allowed) {
			if (!origin.startsWith('https:')) {
				throw new ToolError(`require_https is set; origin must be https: ${origin}`, {
					code: 'bad_auth'
				})
			}
		}
	}

	const target = assertAllowed(input.url, allowed, requireHttps)
	const method = input.method
	const timeout = input.timeout_ms ?? auth.timeout_ms ?? DEFAULT_TIMEOUT_MS
	const http = createWebFetchService(ctx, timeout)

	try {
		const response = await serviceRequestJson(http, 'Web fetch', target.href, {
			method,
			headers: headersForRequest(auth.default_headers, modelHeaders(input.headers)),
			...(input.query === undefined ? {} : { query: input.query }),
			...(input.body === undefined ? {} : { body: input.body }),
			timeout,
			throwOnError: false
		})

		const finalUrl = response.url.length > 0 ? response.url : target.href
		assertAllowed(finalUrl, allowed, requireHttps)

		const contentType = response.headers.get('content-type') ?? undefined
		const headers: Record<string, string> = {}
		response.headers.forEach((value, key) => {
			headers[key.toLowerCase()] = value
		})

		return requestOutputSchema.parse({
			url: finalUrl,
			status: response.status,
			ok: response.ok,
			headers,
			...(contentType === undefined ? {} : { content_type: contentType }),
			body: method === 'HEAD' ? null : response.data
		})
	} catch (error) {
		mapOfetchError(error, 'Web fetch')
	}
}

/** Read-only: GET / HEAD. sideEffect: read */
const webFetchGetTool = defineTool({
	id: 'web-fetch-get',
	name: 'httpGet',
	description:
		'HTTP GET or HEAD against an absolute allowlisted URL. Use to read host-approved APIs. Returns status, headers, and ofetch-parsed body (JSON object when the response is JSON). No request body. Credential headers cannot be set from tool arguments.',
	inputSchema: getInputSchema,
	outputSchema: requestOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) =>
		executeHttp(
			{
				url: input.url,
				method: input.method ?? 'GET',
				...(input.headers === undefined ? {} : { headers: input.headers }),
				...(input.query === undefined ? {} : { query: input.query }),
				...(input.timeout_ms === undefined ? {} : { timeout_ms: input.timeout_ms })
			},
			ctx
		)
})

/** Mutating: POST / PUT / PATCH / DELETE. sideEffect: write */
const webFetchRequestTool = defineTool({
	id: 'web-fetch-request',
	name: 'httpRequest',
	description:
		'HTTP POST, PUT, PATCH, or DELETE against an absolute allowlisted URL. Use for host-approved write/delete APIs and webhooks. Body accepts a string or object (objects/arrays are JSON-encoded automatically). Returns status, headers, and ofetch-parsed body. Credential headers cannot be set from tool arguments.',
	inputSchema: mutateInputSchema,
	outputSchema: requestOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) =>
		executeHttp(
			{
				url: input.url,
				method: input.method ?? 'POST',
				...(input.headers === undefined ? {} : { headers: input.headers }),
				...(input.query === undefined ? {} : { query: input.query }),
				...(input.body === undefined ? {} : { body: input.body }),
				...(input.timeout_ms === undefined ? {} : { timeout_ms: input.timeout_ms })
			},
			ctx
		)
})

export const webFetchModule = defineModule({
	id: 'web-fetch',
	title: 'Web Fetch',
	description:
		'Allowlisted HTTP client (ofetch). Hosts bind origins and optional default headers; models call URLs without setting credentials. GET/HEAD are read; POST/PUT/PATCH/DELETE are write.',
	runtime: 'both',
	auth: { type: 'custom', schema: webFetchAuthSchema },
	tools: [webFetchGetTool, webFetchRequestTool]
})

export { webFetchGetTool, webFetchRequestTool }
