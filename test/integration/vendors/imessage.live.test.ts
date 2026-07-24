import { describe, expect, test } from 'bun:test'

import { ImessageClient } from '../../../src/vendors/imessage'
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

run('live vendor imessage', () => {
	test(
		'send edit typing react clear media read unsend',
		async () => {
			const c = client()
			const sent = await c.sendText({
				chat_id: chatId!,
				text: `[ai-tools it] imessage ${Date.now()}`
			})
			expect(sent.space_id).toBeTruthy()

			if (sent.message_id) {
				const edited = await c.editText({
					chat_id: chatId!,
					message_id: sent.message_id,
					text: `[ai-tools it] imessage edited ${Date.now()}`
				})
				expect(edited.space_id).toBeTruthy()

				await c.sendChatAction({ chat_id: chatId!, action: 'typing' })
				await c.stopTyping({ chat_id: chatId! })

				const reaction = await c.setReaction({
					chat_id: chatId!,
					message_id: sent.message_id,
					emoji: '❤️'
				})
				if (reaction.message_id) {
					await c.clearReaction({
						chat_id: chatId!,
						message_id: reaction.message_id
					})
				}

				await c.read({ chat_id: chatId!, message_id: sent.message_id })
			}

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

			// answerCallback is a no-op parity method
			await c.answerCallback({})
		},
		{ timeout: 60_000 }
	)
})
