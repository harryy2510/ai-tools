import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { emailModule, emailSendBatchTool, emailSendTool } from '../../src/modules/email'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		return handler(url, init)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

function bodyFromInit(init?: RequestInit): Record<string, unknown> {
	const raw = init?.body
	if (typeof raw !== 'string') throw new Error('expected string body')
	return asRecord(JSON.parse(raw))
}

describe('email', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(emailModule).ok).toBe(true)
		expect(emailModule.auth.type).toBe('custom')
		expect(emailModule.tools.map((t) => t.id).sort()).toEqual(['email-send', 'email-send-batch'])
		expect(emailSendTool.id).toBe('email-send')
		expect(emailSendBatchTool.id).toBe('email-send-batch')
	})

	test('resend provider: URL, auth header, unified id output', async () => {
		const bound = withAuth(emailModule, { provider: 'resend', api_key: 're_secret' })
		const tool = bound.tools.find((t) => t.id === 'email-send')
		if (!tool) throw new Error('missing send tool')

		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://api.resend.com/emails')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer re_secret')
			const body = bodyFromInit(init)
			expect(body['to']).toEqual(['a@example.com'])
			expect(body['from']).toBe('b@example.com')
			expect(body['reply_to']).toBe('reply@example.com')
			return new Response(JSON.stringify({ id: 'msg_r1' }), { status: 200 })
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'a@example.com',
					from: 'b@example.com',
					subject: 'Hi',
					text: 'Body',
					reply_to: 'reply@example.com'
				})
			)
			expect(result).toEqual({ success: true, id: 'msg_r1' })
		} finally {
			restore()
		}
	})

	test('cloudflare provider: path, auth header, accepted output', async () => {
		const bound = withAuth(emailModule, {
			provider: 'cloudflare',
			account_id: 'acc_1',
			api_token: 'tok_1'
		})
		const tool = bound.tools.find((t) => t.id === 'email-send')
		if (!tool) throw new Error('missing send tool')

		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc_1/email/sending/send')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer tok_1')
			const body = bodyFromInit(init)
			expect(body['replyTo']).toEqual('reply@example.com')
			expect(body['reply_to']).toBeUndefined()
			return new Response(
				JSON.stringify({
					success: true,
					result: { delivered: ['a@example.com'], queued: [], permanent_bounces: [] }
				}),
				{ status: 200 }
			)
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'a@example.com',
					from: 'b@example.com',
					subject: 'Hi',
					text: 'Body',
					reply_to: 'reply@example.com'
				})
			)
			expect(result).toEqual({ success: true, accepted: ['a@example.com'] })
		} finally {
			restore()
		}
	})

	test('batch tool returns per-message results (resend)', async () => {
		const bound = withAuth(emailModule, { provider: 'resend', api_key: 're_secret' })
		const tool = bound.tools.find((t) => t.id === 'email-send-batch')
		if (!tool) throw new Error('missing batch tool')

		let calls = 0
		const restore = mockFetch(() => {
			calls += 1
			return new Response(JSON.stringify({ id: `msg_${calls}` }), { status: 200 })
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					messages: [
						{ to: 'a@example.com', from: 'f@example.com', subject: '1', text: 'a' },
						{ to: 'b@example.com', from: 'f@example.com', subject: '2', text: 'b' }
					]
				})
			)
			expect(result['succeeded']).toBe(2)
			expect(result['failed']).toBe(0)
			expect(calls).toBe(2)
		} finally {
			restore()
		}
	})

	test('invalid auth rejected at withAuth', () => {
		try {
			withAuth(emailModule, { provider: 'resend', api_key: '' })
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_auth')
		}
	})
})
