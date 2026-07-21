import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { runTool, withAuth } from '../src/core'
import { defineHttpApi } from '../src/http'

describe('defineHttpApi', () => {
	test('builds a module with fixed paths and optional bearer auth', async () => {
		const inputSchema = z.object({
			id: z.string().describe('Item id')
		})
		const outputSchema = z.object({
			id: z.string(),
			name: z.string()
		})

		const module = defineHttpApi({
			id: 'demo',
			title: 'Demo API',
			description: 'Demo fixed HTTP API.',
			baseUrl: 'https://api.example.com',
			auth: {
				type: 'bearer',
				schema: z.object({
					token: z.string().min(1)
				})
			},
			applyAuth: (auth) => ({
				headers: { Authorization: `Bearer ${auth?.token ?? ''}` }
			}),
			actions: [
				{
					id: 'demo-get-item',
					name: 'getItem',
					description: 'Fetch one item by id.',
					method: 'GET',
					path: (input) => {
						const row = inputSchema.parse(input)
						return `/items/${row.id}`
					},
					inputSchema,
					outputSchema,
					mapResponse: (data) => {
						const row = outputSchema.parse(data)
						return row
					}
				}
			]
		})

		const bound = withAuth(module, { token: 'secret' })
		const tool = bound.tools[0]
		if (!tool) throw new Error('expected tool')

		const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toBe('https://api.example.com/items/1')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer secret')
			return new Response(JSON.stringify({ id: '1', name: 'Widget' }), { status: 200 })
		}

		const result = await runTool(tool, { id: '1' }, { fetch: fetchMock })
		expect(result).toEqual({ id: '1', name: 'Widget' })
	})
})
