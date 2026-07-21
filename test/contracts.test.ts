import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { defineTool, validateModule, validateTool } from '../src/core'
import { echoModule, echoTool } from './fixtures/echo-module'

describe('contracts', () => {
	test('accepts well-formed tools', () => {
		expect(validateTool(echoTool).ok).toBe(true)
		expect(validateModule(echoModule).ok).toBe(true)
	})

	test('rejects credential language in model description', () => {
		const bad = defineTool({
			id: 'bad-tool',
			name: 'bad',
			description: 'Call the API using process.env secret key.',
			inputSchema: z.object({
				q: z.string().describe('Query text')
			}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		const result = validateTool(bad)
		expect(result.ok).toBe(false)
		expect(result.issues.some((i) => i.code === 'forbidden_model_copy')).toBe(true)
	})

	test('rejects non-kebab tool ids', () => {
		const bad = defineTool({
			id: 'Not_Kebab',
			name: 'x',
			description: 'Does a thing for testing id format.',
			inputSchema: z.object({}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		expect(validateTool(bad).issues.some((i) => i.code === 'invalid_tool_id')).toBe(true)
	})

	test('rejects missing field describe', () => {
		const bad = defineTool({
			id: 'no-field-desc',
			name: 'x',
			description: 'Tool without field descriptions for contract testing.',
			inputSchema: z.object({
				q: z.string()
			}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		expect(validateTool(bad).issues.some((i) => i.code === 'empty_field_description')).toBe(true)
	})
})
