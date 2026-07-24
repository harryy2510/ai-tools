import { describe, expect, test } from 'bun:test'

import { MessagingClient } from '../../../src/modules/messaging'
import { env } from '../env'

const botToken = env('AI_TOOLS_TELEGRAM_BOT_TOKEN')
const chatId = env('AI_TOOLS_TELEGRAM_CHAT_ID')
const run = botToken ? describe : describe.skip

run('live seam messaging (telegram)', () => {
	test('sendText optional', async () => {
		if (!chatId) return
		const client = MessagingClient.fromAuth({
			provider: 'telegram',
			bot_token: botToken!
		})
		const msg = await client.sendText({
			chat_id: chatId,
			text: `[ai-tools it] messaging seam ${Date.now()}`
		})
		expect(msg.message_id).toBeTruthy()
	})
})
