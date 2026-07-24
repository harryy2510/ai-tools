import { describe, expect, test } from 'bun:test'

import { SlackClient } from '../../../src/vendors/slack'
import { env } from '../env'

const token = env('AI_TOOLS_SLACK_BOT_TOKEN')
const channel = env('AI_TOOLS_SLACK_CHANNEL_ID')
const run = token ? describe : describe.skip

run('live vendor slack', () => {
	test('getBot', async () => {
		const client = new SlackClient({ bot_token: token! })
		const bot = await client.getBot()
		expect(bot.bot_id).toBeTruthy()
	})

	test('sendText (optional channel)', async () => {
		if (!channel) return
		const client = new SlackClient({ bot_token: token! })
		const msg = await client.sendText({
			chat_id: channel,
			text: `[ai-tools it] slack ${Date.now()}`
		})
		expect(msg.message_id).toBeTruthy()
	})
})
