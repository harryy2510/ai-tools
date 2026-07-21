import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { defineProvider, requireAuth, resolveProvider, ToolError } from '../../src/core'

describe('provider seam', () => {
	const aSchema = z.object({
		provider: z.literal('a'),
		token: z.string().min(1)
	})
	const bSchema = z.object({
		provider: z.literal('b'),
		key: z.string().min(1)
	})

	const providers = [
		defineProvider({
			id: 'a',
			title: 'A',
			authSchema: aSchema,
			ops: { kind: 'a' as const }
		}),
		defineProvider({
			id: 'b',
			title: 'B',
			authSchema: bSchema,
			ops: { kind: 'b' as const }
		})
	] as const

	const authUnion = z.discriminatedUnion('provider', [aSchema, bSchema])

	test('resolveProvider picks by auth.provider', () => {
		const auth = authUnion.parse({ provider: 'b', key: 'k' })
		const provider = resolveProvider(providers, auth)
		expect(provider.id).toBe('b')
		expect(provider.ops.kind).toBe('b')
	})

	test('resolveProvider rejects unknown provider', () => {
		expect(() => resolveProvider(providers, { provider: 'nope' })).toThrow(ToolError)
	})

	test('requireAuth validates ctx.auth', () => {
		const auth = requireAuth({ auth: { provider: 'a', token: 't' } }, authUnion)
		expect(auth.provider).toBe('a')
		expect(() => requireAuth({}, authUnion)).toThrow(ToolError)
	})
})
