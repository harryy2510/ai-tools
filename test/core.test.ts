import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { defineModule, defineTool, runTool, ToolError, withAuth } from '../src/core'

describe('defineTool / defineModule', () => {
	test('rejects empty model-facing description', () => {
		expect(() =>
			defineTool({
				id: 'x',
				name: 'x',
				description: '   ',
				inputSchema: z.object({}),
				outputSchema: z.object({}),
				execute: async () => ({})
			})
		).toThrow(/description/)
	})

	test('rejects duplicate tool ids in a module', () => {
		const tool = defineTool({
			id: 'same',
			name: 'same',
			description: 'Does a thing.',
			inputSchema: z.object({}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})

		expect(() =>
			defineModule({
				id: 'mod',
				title: 'Mod',
				description: 'Module',
				tools: [tool, tool]
			})
		).toThrow(/duplicate/i)
	})
})

describe('withAuth', () => {
	const authSchema = z.object({
		apiKey: z.string().min(1)
	})

	const secretTool = defineTool({
		id: 'secret-ping',
		name: 'ping',
		description: 'Return ok when credentials are bound.',
		inputSchema: z.object({}),
		outputSchema: z.object({
			ok: z.boolean(),
			hasKey: z.boolean()
		}),
		execute: async (_input, ctx) => ({
			ok: true,
			hasKey: Boolean(ctx.auth && typeof ctx.auth === 'object' && 'apiKey' in ctx.auth)
		})
	})

	const secretModule = defineModule({
		id: 'secret',
		title: 'Secret',
		description: 'Needs a key.',
		auth: { type: 'custom', schema: authSchema },
		tools: [secretTool]
	})

	test('requires auth when module declares it', () => {
		expect(() => withAuth(secretModule)).toThrow(ToolError)
	})

	test('validates auth and binds it for execute', async () => {
		const bound = withAuth(secretModule, { apiKey: 'k_test' })
		const tool = bound.tools[0]
		if (!tool) throw new Error('expected tool')
		const result = await runTool(tool, {})
		expect(result).toEqual({ ok: true, hasKey: true })
	})

	test('rejects invalid auth shape', () => {
		expect(() => withAuth(secretModule, { apiKey: '' })).toThrow(ToolError)
	})
})

describe('runTool', () => {
	const tool = defineTool({
		id: 'echo',
		name: 'echo',
		description: 'Echo a message.',
		inputSchema: z.object({
			message: z.string().min(1).describe('Text to echo')
		}),
		outputSchema: z.object({
			message: z.string()
		}),
		execute: async ({ message }) => ({ message })
	})

	test('validates input', () => {
		expect(runTool(tool, { message: '' })).rejects.toBeInstanceOf(ToolError)
	})

	test('returns parsed output', () => {
		expect(runTool(tool, { message: 'hi' })).resolves.toEqual({ message: 'hi' })
	})
})
