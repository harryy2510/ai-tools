import type { z } from 'zod'

export type ToolRuntime = 'both' | 'edge' | 'node'

export type ToolSideEffect = 'delete' | 'none' | 'read' | 'send' | 'write'

/** Injectable fetch for tests. Call signature only (no preconnect required). */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type ToolContext<TAuth = unknown> = {
	auth?: TAuth
	extras?: Record<string, unknown>
	/** Injectable fetch for tests and custom runtimes. */
	fetch?: FetchLike
	now?: () => Date
	signal?: AbortSignal
}

/**
 * Public execute boundary always takes unknown input so tools can be collected
 * and projected without type assertions. `defineTool` validates via inputSchema first.
 */
export type ToolExecute = (input: unknown, ctx: ToolContext) => Promise<unknown>

export type ToolMeta = {
	runtime: ToolRuntime
	sideEffect: ToolSideEffect
	tags?: readonly string[]
}

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
	description: string
	/** Stable tool id. Prefer kebab-case (`weather-get`) to match Mastra docs. */
	id: string
	inputSchema: z.ZodType<TInput>
	meta: ToolMeta
	/** Optional friendly name; not used as Mastra stream toolName unless you key by it. */
	name: string
	outputSchema: z.ZodType<TOutput>
	execute: ToolExecute
}

/** Alias for erased module tool lists (same shape as ToolDefinition). */
export type AnyToolDefinition = ToolDefinition

export type AuthDefinition<TAuth> =
	| {
			schema: z.ZodType<TAuth>
			type: 'api_key' | 'basic' | 'bearer' | 'custom' | 'oauth2'
	  }
	| {
			type: 'none'
	  }

export type ModuleDefinition<TAuth = unknown> = {
	auth: AuthDefinition<TAuth>
	description: string
	id: string
	runtime: ToolRuntime
	title: string
	tools: readonly ToolDefinition[]
}

/** Same shape as ToolDefinition; auth is closed over by withAuth. */
export type BoundToolDefinition = ToolDefinition

export type BoundModule<TAuth = unknown> = {
	auth: AuthDefinition<TAuth>
	description: string
	id: string
	runtime: ToolRuntime
	title: string
	tools: readonly BoundToolDefinition[]
}

export type KernelTool = ToolDefinition | BoundToolDefinition
