import { describe, expect, test } from 'bun:test'

import { ImessageClient } from '../../../src/vendors/imessage'
import { env } from '../env'

const baseUrl = env('AI_TOOLS_IMESSAGE_PROXY_URL')
const projectId = env('AI_TOOLS_IMESSAGE_PROJECT_ID')
const projectSecret = env('AI_TOOLS_IMESSAGE_PROJECT_SECRET')
const chatId = env('AI_TOOLS_IMESSAGE_CHAT_ID')
const run = baseUrl && projectId && projectSecret && chatId ? describe : describe.skip

run('live vendor imessage', () => {
	test('sendText via photon-rest-proxy', async () => {
		const client = new ImessageClient({
			base_url: baseUrl!,
			project_id: projectId!,
			project_secret: projectSecret!,
			...(env('AI_TOOLS_IMESSAGE_PHONE') ? { phone: env('AI_TOOLS_IMESSAGE_PHONE') } : {})
		})
		const result = await client.sendText({
			chat_id: chatId!,
			text: `[ai-tools it] imessage ${Date.now()}`
		})
		expect(result.space_id).toBeTruthy()
	})
})
