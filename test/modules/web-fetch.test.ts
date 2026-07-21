import { describe, expect, test } from 'bun:test'
import { isPlainObject, isString } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { webFetchGetTool, webFetchModule, webFetchRequestTool } from '../../src/modules/web-fetch'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function boundTools(auth: {
	allowed_origins: string[]
	default_headers?: Record<string, string>
	require_https?: boolean
}) {
	const bound = withAuth(webFetchModule, auth)
	const get = bound.tools.find((t) => t.id === webFetchGetTool.id)
	const mutate = bound.tools.find((t) => t.id === webFetchRequestTool.id)
	if (!get || !mutate) throw new Error('missing tools')
	return { get, mutate }
}

describe('web-fetch', () => {
	test('passes contracts and side effects', () => {
		expect(validateModule(webFetchModule).ok).toBe(true)
		expect(webFetchGetTool.meta.sideEffect).toBe('read')
		expect(webFetchRequestTool.meta.sideEffect).toBe('write')
		expect(webFetchGetTool.id).toBe('web-fetch-get')
		expect(webFetchRequestTool.id).toBe('web-fetch-request')
	})

	test('GET allowlisted origin (read tool)', async () => {
		const { get } = boundTools({ allowed_origins: ['https://api.example.com'] })
		const result = asRecord(
			await runTool(
				get,
				{ url: 'https://api.example.com/v1/ping', query: { q: '1' } },
				{
					fetch: async (input) => {
						const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
						expect(url).toContain('api.example.com/v1/ping')
						expect(url).toContain('q=1')
						return new Response(JSON.stringify({ ok: true }), {
							status: 200,
							headers: { 'content-type': 'application/json' }
						})
					}
				}
			)
		)
		expect(result['status']).toBe(200)
		expect(result['ok']).toBe(true)
		expect(result['body']).toEqual({ ok: true })
	})

	test('POST mutates with host default_headers', async () => {
		const { mutate } = boundTools({
			allowed_origins: ['https://api.example.com'],
			default_headers: { Authorization: 'Bearer host' }
		})
		await runTool(
			mutate,
			{
				url: 'https://api.example.com/items',
				method: 'POST',
				body: { name: 'a' },
				headers: { Accept: 'application/json' }
			},
			{
				fetch: async (_input, init) => {
					const headers = new Headers(init?.headers)
					expect(init?.method).toBe('POST')
					expect(headers.get('Authorization')).toBe('Bearer host')
					expect(headers.get('content-type')).toContain('application/json')
					expect(isString(init?.body) ? init.body : '').toContain('name')
					return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } })
				}
			}
		)
	})

	test('rejects non-allowlisted origin and model Authorization', async () => {
		const { get } = boundTools({ allowed_origins: ['https://api.example.com'] })
		try {
			await runTool(get, { url: 'https://evil.example/x' })
			throw new Error('expected forbidden')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('forbidden')
		}

		try {
			await runTool(get, {
				url: 'https://api.example.com/x',
				headers: { Authorization: 'Bearer no' }
			})
			throw new Error('expected bad_input')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_input')
		}
	})

	test('non-2xx still returns body; rejects credentials in URL', async () => {
		const { mutate } = boundTools({ allowed_origins: ['https://api.example.com'] })
		const result = asRecord(
			await runTool(
				mutate,
				{ url: 'https://api.example.com/x', method: 'POST', body: 'raw' },
				{
					fetch: async () =>
						new Response(JSON.stringify({ error: 'nope' }), {
							status: 400,
							headers: { 'content-type': 'application/json' }
						})
				}
			)
		)
		expect(result['status']).toBe(400)
		expect(result['ok']).toBe(false)
		expect(result['body']).toEqual({ error: 'nope' })

		const { get } = boundTools({ allowed_origins: ['https://api.example.com'] })
		try {
			await runTool(get, { url: 'https://user:pass@api.example.com/x' })
			throw new Error('expected bad_input')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_input')
		}
	})

	test('require_https', async () => {
		const { get } = boundTools({ allowed_origins: ['http://api.example.com'], require_https: true })
		try {
			await runTool(get, { url: 'http://api.example.com/x' })
			throw new Error('expected error')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
		}
	})
})
