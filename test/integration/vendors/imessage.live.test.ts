import { describe, expect, test } from 'bun:test'

import { ImessageClient, ImessageClientError } from '../../../src/vendors/imessage'
import { env } from '../env'

const baseUrl = env('AI_TOOLS_IMESSAGE_PROXY_URL')
const projectId = env('AI_TOOLS_IMESSAGE_PROJECT_ID')
const projectSecret = env('AI_TOOLS_IMESSAGE_PROJECT_SECRET')
const chatId = env('AI_TOOLS_IMESSAGE_CHAT_ID')
const run = baseUrl && projectId && projectSecret && chatId ? describe : describe.skip

function client() {
	return new ImessageClient({
		base_url: baseUrl!,
		project_id: projectId!,
		project_secret: projectSecret!,
		...(env('AI_TOOLS_IMESSAGE_PHONE') ? { phone: env('AI_TOOLS_IMESSAGE_PHONE') } : {})
	})
}

/** Proxy may 502 on secondary routes while send works — don't fail the whole suite. */
async function bestEffort(label: string, fn: () => Promise<void>): Promise<void> {
	try {
		await fn()
	} catch (error) {
		const status =
			error instanceof ImessageClientError && error.details && typeof error.details === 'object'
				? error.details['status']
				: undefined
		if (status === 502 || status === 503 || status === 504) {
			console.warn(`[imessage it] skip ${label}: proxy HTTP ${String(status)}`)
			return
		}
		throw error
	}
}

run('live vendor imessage', () => {
	test(
		'send (required) + optional edit/typing/react/media/read/unsend',
		async () => {
			const c = client()
			const sent = await c.sendText({
				chat_id: chatId!,
				text: `[ai-tools it] imessage ${Date.now()}`
			})
			expect(sent.space_id).toBeTruthy()

			if (sent.message_id) {
				await bestEffort('editText', async () => {
					const edited = await c.editText({
						chat_id: chatId!,
						message_id: sent.message_id!,
						text: `[ai-tools it] imessage edited ${Date.now()}`
					})
					expect(edited.space_id).toBeTruthy()
				})

				await bestEffort('typing', async () => {
					await c.sendChatAction({ chat_id: chatId!, action: 'typing' })
					await c.stopTyping({ chat_id: chatId! })
				})

				await bestEffort('setReaction/clearReaction', async () => {
					const reaction = await c.setReaction({
						chat_id: chatId!,
						message_id: sent.message_id!,
						emoji: '❤️'
					})
					if (reaction.message_id) {
						await c.clearReaction({
							chat_id: chatId!,
							message_id: reaction.message_id
						})
					}
				})

				await bestEffort('read', async () => {
					await c.read({ chat_id: chatId!, message_id: sent.message_id! })
				})
			}

			await bestEffort('sendMedia/unsend', async () => {
				const media = await c.sendMedia({
					chat_id: chatId!,
					kind: 'document',
					file_name: 'ai-tools-it.txt',
					body_base64: Buffer.from('imessage media it').toString('base64'),
					content_type: 'text/plain'
				})
				expect(media.space_id).toBeTruthy()
				if (media.message_id) {
					await c.unsend({ chat_id: chatId!, message_id: media.message_id })
				}
			})

			await c.answerCallback({})
		},
		{ timeout: 60_000 }
	)
})
