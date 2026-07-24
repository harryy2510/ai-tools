import { describe, expect, test } from 'bun:test'

import { SlackClient } from '../../../src/vendors/slack'
import { env } from '../env'

const token = env('AI_TOOLS_SLACK_BOT_TOKEN')
const channel = env('AI_TOOLS_SLACK_CHANNEL_ID')
const run = token ? describe : describe.skip

run('live vendor slack', () => {
	test('getBot + listConversations', async () => {
		const client = new SlackClient({ bot_token: token! })
		const bot = await client.getBot()
		expect(bot.bot_id).toBeTruthy()
		const convos = await client.listConversations({ limit: 5 })
		expect(Array.isArray(convos.channels)).toBe(true)
	})

	test(
		'channel surface: send edit action react media (optional channel)',
		async () => {
			if (!channel) return
			const client = new SlackClient({ bot_token: token! })
			const msg = await client.sendText({
				chat_id: channel,
				text: `[ai-tools it] slack ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()

			const edited = await client.editText({
				chat_id: channel,
				message_id: msg.message_id,
				text: `[ai-tools it] slack edited ${Date.now()}`
			})
			expect(edited.message_id).toBeTruthy()

			await client.sendChatAction({ chat_id: channel, action: 'typing' })

			await client.setReaction({
				chat_id: channel,
				message_id: msg.message_id,
				emoji: 'thumbsup'
			})
			await client.clearReaction({
				chat_id: channel,
				message_id: msg.message_id,
				emoji: 'thumbsup'
			})

			const media = await client.sendMedia({
				chat_id: channel,
				kind: 'document',
				file_name: 'ai-tools-it.txt',
				body_base64: Buffer.from('slack media it').toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()
		},
		{ timeout: 30_000 }
	)
})
