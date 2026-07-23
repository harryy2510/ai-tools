import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { bytesToBase64 } from '../../src/shared/bytes'
import {
	createLiveMessage,
	isTelegramDefiniteRejection,
	isTelegramOutcomeUnknown,
	parseTelegramUpdate,
	TelegramClient,
	telegramModule,
	verifyTelegramWebhookSecret
} from '../../src/vendors/telegram'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('telegram webhook helpers', () => {
	test('verifies secret token', () => {
		expect(verifyTelegramWebhookSecret('abc', 'abc')).toBe(true)
		expect(verifyTelegramWebhookSecret('abc', 'abd')).toBe(false)
		expect(verifyTelegramWebhookSecret(null, 'abc')).toBe(false)
	})

	test('parses private text message', () => {
		const parsed = parseTelegramUpdate({
			update_id: 42,
			message: {
				message_id: 7,
				text: 'hello',
				chat: { id: 100, type: 'private' },
				from: { id: 9, username: 'alice' }
			}
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		expect(parsed.event.channel).toBe('telegram')
		expect(parsed.event.event_id).toBe('42')
		expect(parsed.event.chat_id).toBe('100')
		expect(parsed.event.message_id).toBe('7')
		expect(parsed.event.text).toBe('hello')
		expect(parsed.event.user_id).toBe('9')
		expect(parsed.event.username).toBe('alice')
	})

	test('rejects non-private chat by default', () => {
		const parsed = parseTelegramUpdate({
			update_id: 1,
			message: {
				message_id: 1,
				text: 'hi',
				chat: { id: 2, type: 'group' },
				from: { id: 3 }
			}
		})
		expect(parsed.ok).toBe(false)
	})

	test('parses photo media and media_group_id', () => {
		const parsed = parseTelegramUpdate({
			update_id: 5,
			message: {
				message_id: 8,
				caption: 'pic',
				media_group_id: 'album-1',
				chat: { id: 1, type: 'private' },
				from: { id: 2 },
				photo: [
					{ file_id: 'small', file_unique_id: 'u1', file_size: 10 },
					{ file_id: 'large', file_unique_id: 'u2', file_size: 99 }
				]
			}
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		expect(parsed.event.media_group_id).toBe('album-1')
		expect(parsed.event.media?.[0]?.ref).toBe('large')
		expect(parsed.event.text).toBe('pic')
	})
})

describe('telegram live message', () => {
	test('start update finalize uses send then edit', async () => {
		const events: string[] = []
		const live = createLiveMessage({
			intervalMs: 0,
			sendText: async (text) => {
				events.push(`send:${text}`)
				return { message_id: 'm1' }
			},
			editText: async (messageId, text) => {
				events.push(`edit:${messageId}:${text}`)
				return { message_id: messageId }
			},
			isDefiniteRejection: () => false,
			isOutcomeUnknown: () => false
		})

		await live.start('hello')
		await live.update('hello world')
		await new Promise((r) => setTimeout(r, 5))
		const final = await live.finalize('hello world final')
		expect(final.message_id).toBe('m1')
		expect(events[0]).toBe('send:hello')
		expect(events.some((e) => e.startsWith('edit:m1:'))).toBe(true)
	})
})

describe('telegram module', () => {
	test('passes contracts', () => {
		expect(validateModule(telegramModule).ok).toBe(true)
		expect(telegramModule.tools.map((t) => t.id).sort()).toEqual([
			'telegram-answer-callback',
			'telegram-clear-reaction',
			'telegram-download-file',
			'telegram-edit-text',
			'telegram-get-bot',
			'telegram-send-chat-action',
			'telegram-send-media',
			'telegram-send-media-group',
			'telegram-send-text',
			'telegram-set-reaction'
		])
	})

	test('sendText tool posts to Bot API', async () => {
		const bound = withAuth(telegramModule, { bot_token: '123:ABC' })
		const tool = bound.tools.find((t) => t.id === 'telegram-send-text')
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toBe('https://api.telegram.org/bot123:ABC/sendMessage')
			expect(init?.method).toBe('POST')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.chat_id).toBe('99')
			expect(body.text).toBe('hi')
			expect(body.reply_parameters).toEqual({ message_id: 5 })
			return new Response(JSON.stringify({ ok: true, result: { message_id: 11 } }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					chat_id: '99',
					text: 'hi',
					reply_to_message_id: '5'
				})
			)
			expect(result['message_id']).toBe('11')
		} finally {
			globalThis.fetch = original
		}
	})

	test('setReaction accepts any emoji', async () => {
		const bound = withAuth(telegramModule, { bot_token: '123:ABC' })
		const tool = bound.tools.find((t) => t.id === 'telegram-set-reaction')
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.reaction).toEqual([{ type: 'emoji', emoji: '🔥' }])
			return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(await runTool(tool, { chat_id: '1', message_id: '2', emoji: '🔥' }))
			expect(result['ok']).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})

	test('client sendMedia and media group', async () => {
		const original = globalThis.fetch
		const seen: string[] = []
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			seen.push(url)
			if (url.endsWith('/sendPhoto') || url.endsWith('/sendMediaGroup')) {
				return new Response(
					JSON.stringify(
						url.endsWith('/sendMediaGroup')
							? { ok: true, result: [{ message_id: 1 }, { message_id: 2 }] }
							: { ok: true, result: { message_id: 3 } }
					),
					{ status: 200 }
				)
			}
			return new Response(JSON.stringify({ ok: false, description: 'unexpected' }), { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const client = new TelegramClient({ bot_token: 't' })
			const one = await client.sendMedia({
				chat_id: '1',
				kind: 'photo',
				body_base64: bytesToBase64(new TextEncoder().encode('img')),
				file_name: 'a.jpg'
			})
			expect(one.message_id).toBe('3')

			const group = await client.sendMediaGroup({
				chat_id: '1',
				items: [
					{
						kind: 'photo',
						body_base64: bytesToBase64(new TextEncoder().encode('a')),
						file_name: 'a.jpg'
					},
					{
						kind: 'photo',
						body_base64: bytesToBase64(new TextEncoder().encode('b')),
						file_name: 'b.jpg'
					}
				]
			})
			expect(group.message_ids).toEqual(['1', '2'])
			expect(seen.some((u) => u.endsWith('/sendPhoto'))).toBe(true)
			expect(seen.some((u) => u.endsWith('/sendMediaGroup'))).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})

	test('maps definite rejection', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ ok: false, description: 'Bad Request' }), {
				status: 400
			})) as unknown as typeof globalThis.fetch

		try {
			const client = new TelegramClient({ bot_token: 't' })
			let caught: unknown
			try {
				await client.sendText({ chat_id: '1', text: 'x' })
			} catch (error) {
				caught = error
			}
			expect(isTelegramDefiniteRejection(caught)).toBe(true)
			expect(isTelegramOutcomeUnknown(new Error('nope'))).toBe(false)
		} finally {
			globalThis.fetch = original
		}
	})
})
