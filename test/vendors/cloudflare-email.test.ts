import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { CloudflareEmailClient, cloudflareEmailModule } from '../../src/vendors/cloudflare-email'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('cloudflare-email vendor', () => {
	test('passes contracts', () => {
		expect(validateModule(cloudflareEmailModule).ok).toBe(true)
		expect(cloudflareEmailModule.tools.map((t) => t.id).sort()).toEqual([
			'cloudflare-email-send',
			'cloudflare-email-send-batch'
		])
	})

	test('CloudflareEmailClient send', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(init?.method).toBe('POST')
			return new Response(
				JSON.stringify({
					success: true,
					result: {
						delivered: ['hello@example.com'],
						queued: [],
						permanent_bounces: []
					}
				}),
				{ status: 200 }
			)
		}) as typeof globalThis.fetch

		try {
			const client = new CloudflareEmailClient({
				account_id: 'acc',
				api_token: 'tok'
			})
			const result = await client.send({
				to: 'hello@example.com',
				from: 'from@example.com',
				subject: 'Hi',
				text: 'Body'
			})
			expect(result.success).toBe(true)
			expect(result.accepted).toEqual(['hello@example.com'])
		} finally {
			globalThis.fetch = original
		}
	})

	test('tool path via withAuth', async () => {
		const bound = withAuth(cloudflareEmailModule, {
			account_id: 'acc',
			api_token: 'tok'
		})
		const tool = bound.tools[0]
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					success: true,
					result: { delivered: ['a@example.com'], queued: [], permanent_bounces: [] }
				}),
				{ status: 200 }
			)) as unknown as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'a@example.com',
					from: 'b@example.com',
					subject: 'Hi',
					text: 'x'
				})
			)
			expect(result['success']).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})

	test('success:false maps bad_auth', async () => {
		const client = new CloudflareEmailClient({ account_id: 'acc', api_token: 'tok' })
		const original = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					success: false,
					errors: [{ code: 10000, message: 'Authentication error' }]
				}),
				{ status: 200 }
			)) as unknown as typeof globalThis.fetch

		try {
			await client.send({
				to: 'a@example.com',
				from: 'b@example.com',
				subject: 'Hi',
				text: 'x'
			})
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_auth')
		} finally {
			globalThis.fetch = original
		}
	})
})
