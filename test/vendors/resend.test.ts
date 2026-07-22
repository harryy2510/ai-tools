import { describe, expect, test } from 'bun:test'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { ResendClient, resendModule } from '../../src/vendors/resend'

describe('resend vendor', () => {
	test('passes contracts', () => {
		expect(validateModule(resendModule).ok).toBe(true)
		expect(resendModule.tools.map((t) => t.id).sort()).toEqual(['resend-send', 'resend-send-batch'])
	})

	test('ResendClient send', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toContain('api.resend.com/emails')
			return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })
		}) as typeof globalThis.fetch

		try {
			const client = new ResendClient({ api_key: 're_test' })
			const result = await client.send({
				to: 'a@example.com',
				from: 'b@example.com',
				subject: 'Hi',
				text: 'Body'
			})
			expect(result.success).toBe(true)
			expect(result.id).toBe('msg_1')
		} finally {
			globalThis.fetch = original
		}
	})

	test('tool path via withAuth', async () => {
		const bound = withAuth(resendModule, { api_key: 're_test' })
		const tool = bound.tools.find((t) => t.id === 'resend-send')
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ id: 'msg_2' }), { status: 200 })) as unknown as typeof globalThis.fetch

		try {
			const result = await runTool(tool, {
				to: 'a@example.com',
				from: 'b@example.com',
				subject: 'Hi',
				html: '<p>x</p>'
			})
			expect(result).toEqual({ success: true, id: 'msg_2' })
		} finally {
			globalThis.fetch = original
		}
	})

	test('recipient limit', async () => {
		const client = new ResendClient({ api_key: 're_test' })
		const many = Array.from({ length: 51 }, (_, i) => `u${i}@example.com`)
		try {
			await client.send({
				to: many,
				from: 'from@example.com',
				subject: 'Hi',
				text: 'x'
			})
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_input')
		}
	})
})
