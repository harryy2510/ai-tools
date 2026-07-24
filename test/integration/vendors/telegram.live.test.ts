import { describe, expect, test } from 'bun:test'

import { TelegramClient } from '../../../src/vendors/telegram'
import { env } from '../env'

const botToken = env('AI_TOOLS_TELEGRAM_BOT_TOKEN')
const chatId = env('AI_TOOLS_TELEGRAM_CHAT_ID')
const run = botToken ? describe : describe.skip

run('live vendor telegram', () => {
	test('getBot', async () => {
		const client = new TelegramClient({ bot_token: botToken! })
		const bot = await client.getBot()
		expect(bot.bot_id).toBeTruthy()
		expect(bot.username).toBeTruthy()
	})

	test('sendText (optional chat)', async () => {
		if (!chatId) return
		const client = new TelegramClient({ bot_token: botToken! })
		const msg = await client.sendText({
			chat_id: chatId,
			text: `[ai-tools it] telegram ${Date.now()}`
		})
		expect(msg.message_id).toBeTruthy()
	})
})
