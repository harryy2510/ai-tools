import { z } from 'zod'

import { defineModule, defineTool } from '../core/define'
import type { AuthDefinition, ModuleDefinition, ToolContext, ToolRuntime } from '../core/types'
import { applyBearerAuth } from './auth-applicators'
import { httpRequest } from './client'
import type { HttpMethod } from './client'

export type HttpAuthApplicator<TAuth> = (
	auth: TAuth | undefined,
	ctx: ToolContext
) => { headers?: Record<string, string> }

export type HttpActionDefinition<TInput, TOutput> = {
	description: string
	id: string
	inputSchema: z.ZodType<TInput>
	method: HttpMethod
	name: string
	outputSchema: z.ZodType<TOutput>
	path: string | ((input: TInput) => string)
	query?: (input: TInput) => Record<string, string | number | boolean | undefined>
	body?: (input: TInput) => unknown
	mapResponse: (data: unknown, input: TInput) => TOutput
	sideEffect?: 'delete' | 'none' | 'read' | 'send' | 'write'
	timeoutMs?: number
}

type HttpActionConfig = {
	description: string
	id: string
	inputSchema: z.ZodType
	method: HttpMethod
	name: string
	outputSchema: z.ZodType
	path: string | ((input: unknown) => string)
	query?: (input: unknown) => Record<string, string | number | boolean | undefined>
	body?: (input: unknown) => unknown
	mapResponse: (data: unknown, input: unknown) => unknown
	sideEffect?: 'delete' | 'none' | 'read' | 'send' | 'write'
	timeoutMs?: number
}

export type DefineHttpApiOptions<TAuth = unknown> = {
	auth?: AuthDefinition<TAuth>
	/** How to turn validated auth into request headers. */
	applyAuth?: HttpAuthApplicator<TAuth>
	baseUrl: string
	description: string
	id: string
	runtime?: ToolRuntime
	title: string
	/**
	 * Heterogeneous action list. Call sites keep concrete input/output types on each action;
	 * the factory erases them into the module tool list.
	 */
	actions: ReadonlyArray<HttpActionConfig>
	defaultHeaders?: Record<string, string>
	timeoutMs?: number
}

function resolveAuth<TAuth>(authDef: AuthDefinition<TAuth> | undefined, ctx: ToolContext): TAuth | undefined {
	if (!authDef || authDef.type === 'none') return undefined
	if (ctx.auth === undefined) return undefined
	return authDef.schema.parse(ctx.auth)
}

export function defineHttpApi<TAuth = unknown>(options: DefineHttpApiOptions<TAuth>): ModuleDefinition<TAuth> {
	const applyAuth: HttpAuthApplicator<TAuth> =
		options.applyAuth ??
		(options.auth?.type === 'bearer' ? (auth, ctx) => applyBearerAuth(auth, ctx) : (_auth, _ctx) => ({}))

	const tools = options.actions.map((action) =>
		defineTool({
			id: action.id,
			name: action.name,
			description: action.description,
			inputSchema: action.inputSchema,
			outputSchema: action.outputSchema,
			runtime: options.runtime ?? 'both',
			sideEffect: action.sideEffect ?? 'read',
			execute: async (input, ctx) => {
				const path = typeof action.path === 'function' ? action.path(input) : action.path
				const auth = resolveAuth(options.auth, ctx)
				const authHeaders = applyAuth(auth, ctx)

				const { data } = await httpRequest(
					{
						baseUrl: options.baseUrl,
						method: action.method,
						path,
						headers: {
							...options.defaultHeaders,
							...authHeaders.headers
						},
						...(action.query === undefined ? {} : { query: action.query(input) }),
						...(action.body === undefined ? {} : { body: action.body(input) }),
						...(action.timeoutMs === undefined && options.timeoutMs === undefined
							? {}
							: { timeoutMs: action.timeoutMs ?? options.timeoutMs }),
						...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
						...(ctx.fetch === undefined ? {} : { fetchImpl: ctx.fetch })
					},
					ctx
				)

				const mapped = action.mapResponse(data, input)
				return action.outputSchema.parse(mapped)
			}
		})
	)

	return defineModule({
		id: options.id,
		title: options.title,
		description: options.description,
		runtime: options.runtime ?? 'both',
		auth: options.auth ?? { type: 'none' },
		tools
	})
}

/** Common bearer token auth schema for HTTP APIs (host-facing, not model-facing). */
export const bearerAuthSchema = z.object({
	token: z.string().min(1).describe('API bearer token')
})
