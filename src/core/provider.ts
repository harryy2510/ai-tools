import type { z } from 'zod'

import { ToolError } from './errors'
import type { ToolContext } from './types'

/**
 * Provider type-class entry for a capability module.
 * Auth schemas always include a `provider` literal discriminator.
 * Ops receive auth only via `ctx.auth` (never tool inputs).
 */
export type ProviderDefinition<TId extends string = string, TAuth = unknown, TOps = unknown> = {
	id: TId
	title: string
	authSchema: z.ZodType<TAuth>
	ops: TOps
}

export type ProviderAuthBase = {
	provider: string
}

export function defineProvider<const TId extends string, TAuth extends { provider: TId }, TOps>(options: {
	id: TId
	title: string
	authSchema: z.ZodType<TAuth>
	ops: TOps
}): ProviderDefinition<TId, TAuth, TOps> {
	if (!options.id.trim()) {
		throw new Error('Provider id is required')
	}
	if (!options.title.trim()) {
		throw new Error(`Provider ${options.id} is missing a title`)
	}
	return {
		id: options.id,
		title: options.title,
		authSchema: options.authSchema,
		ops: options.ops
	}
}

/** Resolve a registered provider by `auth.provider`. */
export function resolveProvider<T extends ProviderDefinition>(providers: readonly T[], auth: ProviderAuthBase): T {
	const found = providers.find((provider) => provider.id === auth.provider)
	if (!found) {
		throw new ToolError(`Unknown provider: ${auth.provider}`, {
			code: 'bad_auth',
			details: { provider: auth.provider }
		})
	}
	return found
}

/** Parse host-bound credentials for a module auth schema. */
export function requireAuth<TAuth>(ctx: ToolContext, schema: z.ZodType<TAuth>): TAuth {
	const parsed = schema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('Invalid auth credentials', {
			code: 'bad_auth',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}
