import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	ImessageClient,
	imessageModule,
	isImessageDefiniteRejection,
	isImessageOutcomeUnknown
} from '../../src/vendors/imessage'

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

const auth = {
	base_url: 'https://proxy.example.com',
	project_id: 'proj_1',
	project_secret: 'sec_1'
} as const

describe('imessage', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(imessageModule).ok).toBe(true)
		expect(imessageModule.tools.map((t) => t.id).sort()).toEqual([
			'imessage-edit-text',
			'imessage-read',
			'imessage-send-chat-action',
			'imessage-send-text',
			'imessage-set-reaction',
			'imessage-unsend'
		])
	})

	test('sendText posts to proxy with spectrum headers', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://proxy.example.com/v1/send')
			expect(init?.method).toBe('POST')
			const headers = new Headers(init?.headers)
			expect(headers.get('x-spectrum-project-id')).toBe('proj_1')
			expect(headers.get('x-spectrum-project-secret')).toBe('sec_1')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.space_id).toBe('any;-;+15551111111')
			expect(body.text).toBe('hello')
			expect(body.platform).toBe('imessage')
			return new Response(JSON.stringify({ ok: true, message_id: 'msg_1', space_id: body.space_id }), {
				status: 200
			})
		})

		try {
			const client = new ImessageClient(auth)
			const result = await client.sendText({
				chat_id: 'any;-;+15551111111',
				text: 'hello'
			})
			expect(result).toEqual({ message_id: 'msg_1', space_id: 'any;-;+15551111111' })
		} finally {
			restore()
		}
	})

	test('sendText tool via withAuth', async () => {
		const bound = withAuth(imessageModule, auth)
		const tool = bound.tools.find((t) => t.id === 'imessage-send-text')
		if (!tool) throw new Error('missing tool')

		const restore = mockFetch(
			() => new Response(JSON.stringify({ ok: true, message_id: 'm2', space_id: 'space-a' }), { status: 200 })
		)
		try {
			const result = asRecord(await runTool(tool, { chat_id: 'space-a', text: 'hi' }))
			expect(result['message_id']).toBe('m2')
			expect(result['space_id']).toBe('space-a')
		} finally {
			restore()
		}
	})

	test('maps 401 to definite rejection', async () => {
		const restore = mockFetch(
			() => new Response(JSON.stringify({ error: 'unauthorized', detail: 'Missing header' }), { status: 401 })
		)
		try {
			const client = new ImessageClient(auth)
			let caught: unknown
			try {
				await client.sendText({ chat_id: 's', text: 'x' })
			} catch (error) {
				caught = error
			}
			expect(isImessageDefiniteRejection(caught)).toBe(true)
			expect(isImessageOutcomeUnknown(new Error('nope'))).toBe(false)
		} finally {
			restore()
		}
	})

	test('clearReaction is unsupported', async () => {
		const client = new ImessageClient(auth)
		try {
			await client.clearReaction({ chat_id: 's', message_id: 'm' })
			expect(true).toBe(false)
		} catch (error) {
			expect(isToolError(error) && error.code === 'unsupported').toBe(true)
		}
	})
})
