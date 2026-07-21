import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { emailModule, sendEmailTool } from '../../src/modules/email'

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

	test('cloudflare provider sends and maps accepted addresses', async () => {
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

	test('resend provider returns message id', async () => {
		const bound = withAuth(emailModule, {
			provider: 'resend',
			apiKey: 're_test'
		})
		const tool = bound.tools[0]
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toContain('api.resend.com')
			return new Response(JSON.stringify({ id: 'msg_123' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'a@example.com',
					from: 'b@example.com',
					subject: 'Hi',
					html: '<p>x</p>'
				})
			)
			expect(result['success']).toBe(true)
			expect(result['id']).toBe('msg_123')
		} finally {
			globalThis.fetch = original
		}
	})
})
