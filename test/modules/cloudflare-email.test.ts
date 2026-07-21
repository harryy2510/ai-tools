import { describe, expect, test } from 'bun:test'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { cloudflareEmailModule, sendEmailTool } from '../../src/modules/cloudflare-email'
import { bytesToBase64, utf8ToBytes } from '../../src/shared/bytes'

function requestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input
	if (input instanceof URL) return input.href
	return input.url
}

function requestBodyText(body: BodyInit | null | undefined): string {
	if (typeof body === 'string') return body
	throw new Error('expected string body')
}

describe('cloudflare-email', () => {
	test('passes contracts', () => {
		expect(validateModule(cloudflareEmailModule).ok).toBe(true)
	})

	test('send maps Cloudflare result envelope', async () => {
		const bound = withAuth(cloudflareEmailModule, {
			accountId: 'acc_123',
			apiToken: 'token_abc'
		})
		const tool = bound.tools[0]
		if (!tool) throw new Error('expected tool')

		const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
			expect(requestUrl(input)).toContain('/accounts/acc_123/email/sending/send')
			expect(init?.method).toBe('POST')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer token_abc')
			const bodyUnknown: unknown = JSON.parse(requestBodyText(init?.body ?? null))
			if (typeof bodyUnknown !== 'object' || bodyUnknown === null || !('subject' in bodyUnknown)) {
				throw new Error('expected subject')
			}
			expect(bodyUnknown.subject).toBe('Hello')
			return new Response(
				JSON.stringify({
					success: true,
					result: {
						delivered: ['a@example.com'],
						queued: [],
						permanent_bounces: []
					}
				}),
				{ status: 200 }
			)
		}

		const result = await runTool(
			tool,
			{
				to: 'a@example.com',
				from: 'noreply@example.com',
				subject: 'Hello',
				text: 'Hi there'
			},
			{ fetch: fetchMock }
		)
		expect(result).toEqual({
			success: true,
			delivered: ['a@example.com'],
			queued: [],
			permanent_bounces: []
		})
		expect(sendEmailTool.id).toBe('cloudflare-email-send')
	})

	test('rejects oversized payload before network', async () => {
		const bound = withAuth(cloudflareEmailModule, {
			accountId: 'acc_123',
			apiToken: 'token_abc'
		})
		const tool = bound.tools[0]
		if (!tool) throw new Error('expected tool')

		let called = false
		const fetchMock = async () => {
			called = true
			return new Response('{}', { status: 200 })
		}

		const huge = 'x'.repeat(5 * 1024 * 1024)
		try {
			await runTool(
				tool,
				{
					to: 'a@example.com',
					from: 'noreply@example.com',
					subject: 'Hello',
					text: huge
				},
				{ fetch: fetchMock }
			)
			throw new Error('expected too_large')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) {
				expect(error.code).toBe('too_large')
			}
			expect(called).toBe(false)
		}
	})

	test('maps success:false errors to ToolError codes', async () => {
		const bound = withAuth(cloudflareEmailModule, {
			accountId: 'acc_123',
			apiToken: 'token_abc'
		})
		const tool = bound.tools[0]
		if (!tool) throw new Error('expected tool')

		const fetchMock = async () =>
			new Response(
				JSON.stringify({
					success: false,
					errors: [{ code: 9109, message: 'Authentication error' }]
				}),
				{ status: 200 }
			)

		try {
			await runTool(
				tool,
				{
					to: 'a@example.com',
					from: 'noreply@example.com',
					subject: 'Hello',
					text: 'Hi',
					attachments: [
						{
							filename: 'a.txt',
							type: 'text/plain',
							content: bytesToBase64(utf8ToBytes('hi'))
						}
					]
				},
				{ fetch: fetchMock }
			)
			throw new Error('expected ToolError')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) {
				expect(error.code).toBe('bad_auth')
				expect(error.message).toContain('Authentication')
			}
		}
	})
})
