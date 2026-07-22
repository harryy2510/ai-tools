import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { EmailClient, emailModule, sendEmailTool } from '../../src/modules/email'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('email', () => {
	test('passes contracts', () => {
		expect(validateModule(emailModule).ok).toBe(true)
		expect(sendEmailTool.id).toBe('email-send')
		expect(sendEmailTool.meta.sideEffect).toBe('send')
	})

	test('EmailClient send via resend', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toContain('api.resend.com/emails')
			return new Response(JSON.stringify({ id: 'msg_123' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}) as typeof globalThis.fetch

		try {
			const client = new EmailClient({ provider: 'resend', apiKey: 're_test' })
			expect(client.provider).toBe('resend')
			const result = await client.send({
				to: 'a@example.com',
				from: 'b@example.com',
				subject: 'Hi',
				html: '<p>x</p>'
			})
			expect(result.success).toBe(true)
			expect(result.id).toBe('msg_123')
			// honest: no fake accepted[] from `to`
			expect(result.accepted).toBeUndefined()
		} finally {
			globalThis.fetch = original
		}
	})

	test('EmailClient rejects invalid auth', () => {
		expect(() => new EmailClient({ provider: 'resend', apiKey: '' })).toThrow()
	})

	test('EmailClient enforces recipient limit', async () => {
		const client = new EmailClient({ provider: 'resend', apiKey: 're_test' })
		const many = Array.from({ length: 51 }, (_, i) => `u${i}@example.com`)
		try {
			await client.send({
				to: many,
				from: 'from@example.com',
				subject: 'Hi',
				text: 'x'
			})
			expect.unreachable('should throw')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_input')
		}
	})

	test('cloudflare tool path still works via client', async () => {
		const bound = withAuth(emailModule, {
			provider: 'cloudflare',
			accountId: 'acc',
			apiToken: 'tok'
		})
		const tool = bound.tools[0]
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(init?.method).toBe('POST')
			const body = typeof init?.body === 'string' ? init.body : ''
			expect(body).toContain('hello@example.com')
			return new Response(
				JSON.stringify({
					success: true,
					result: {
						delivered: ['hello@example.com'],
						queued: [],
						permanent_bounces: []
					}
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'hello@example.com',
					from: 'from@example.com',
					subject: 'Hi',
					text: 'Body'
				})
			)
			expect(result['success']).toBe(true)
			expect(result['accepted']).toEqual(['hello@example.com'])
		} finally {
			globalThis.fetch = original
		}
	})

	test('cloudflare success:false maps errors', async () => {
		const client = new EmailClient({
			provider: 'cloudflare',
			accountId: 'acc',
			apiToken: 'tok'
		})
		const original = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					success: false,
					errors: [{ code: 10000, message: 'Authentication error' }]
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)) as unknown as typeof globalThis.fetch

		try {
			await client.send({
				to: 'a@example.com',
				from: 'b@example.com',
				subject: 'Hi',
				text: 'x'
			})
			expect.unreachable('should throw')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_auth')
		} finally {
			globalThis.fetch = original
		}
	})
})
