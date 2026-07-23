import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { MessagingClient, messagingModule } from '../../src/modules/messaging'

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

describe('messaging seam', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(messagingModule).ok).toBe(true)
		expect(messagingModule.tools.map((t) => t.id).sort()).toEqual([
			'messaging-answer-callback',
			'messaging-clear-reaction',
			'messaging-download-file',
			'messaging-edit-text',
			'messaging-send-chat-action',
			'messaging-send-media',
			'messaging-send-text',
			'messaging-set-reaction'
		])
	})

	test('telegram provider sendText via withAuth', async () => {
		const bound = withAuth(messagingModule, { provider: 'telegram', bot_token: '123:ABC' })
		const tool = bound.tools.find((t) => t.id === 'messaging-send-text')
		if (!tool) throw new Error('missing tool')

		const restore = mockFetch((url, init) => {
			expect(url).toContain('api.telegram.org/bot123:ABC/sendMessage')
			expect(init?.method).toBe('POST')
			return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 })
		})
		try {
			const result = asRecord(await runTool(tool, { chat_id: '99', text: 'hello' }))
			expect(result['message_id']).toBe('42')
		} finally {
			restore()
		}
	})

	test('slack provider sendText via MessagingClient.fromAuth', async () => {
		const restore = mockFetch((url) => {
			expect(url).toContain('slack.com/api/chat.postMessage')
			return new Response(JSON.stringify({ ok: true, ts: '1710000000.000100', channel: 'C1' }), {
				status: 200
			})
		})
		try {
			const client = MessagingClient.fromAuth({ provider: 'slack', bot_token: 'xoxb-test' })
			const result = await client.sendText({ chat_id: 'C1', text: 'hi' })
			expect(result.message_id).toBe('1710000000.000100')
		} finally {
			restore()
		}
	})

	test('teams provider requires service_url on sendText', async () => {
		const client = MessagingClient.fromAuth({
			provider: 'teams',
			app_id: 'app',
			app_password: 'secret'
		})
		let code: string | undefined
		try {
			await client.sendText({ chat_id: 'conv', text: 'hi' })
		} catch (error) {
			if (isToolError(error)) code = error.code
		}
		expect(code).toBe('bad_input')
	})

	test('teams provider sendText after token', async () => {
		const restore = mockFetch((url, init) => {
			if (url.includes('login.microsoftonline.com')) {
				return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 })
			}
			expect(url).toContain('smba.trafficmanager.net')
			expect(url).toContain('/v3/conversations/')
			expect(init?.method).toBe('POST')
			return new Response(JSON.stringify({ id: 'act-1' }), { status: 200 })
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'teams',
				app_id: 'app',
				app_password: 'secret'
			})
			const result = await client.sendText({
				chat_id: '19:abc@thread.tacv2',
				text: 'hello teams',
				service_url: 'https://smba.trafficmanager.net/amer/'
			})
			expect(result.message_id).toBe('act-1')
		} finally {
			restore()
		}
	})
})
