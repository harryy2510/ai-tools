import { describe, expect, test } from 'bun:test'

import { ResendClient } from '../../../src/vendors/resend'
import { env } from '../env'

const apiKey = env('AI_TOOLS_RESEND_API_KEY')
const from = env('AI_TOOLS_RESEND_FROM')
const to = env('AI_TOOLS_RESEND_TO')
const run = apiKey && from && to ? describe : describe.skip

run('live vendor resend', () => {
	test('send text email', async () => {
		const client = new ResendClient({ api_key: apiKey! })
		const result = await client.send({
			from: from!,
			to: to!,
			subject: `[ai-tools it] resend ${Date.now()}`,
			text: 'ai-tools integration test (resend)'
		})
		expect(result.id).toBeTruthy()
	})

	test('sendBatch two messages', async () => {
		const client = new ResendClient({ api_key: apiKey! })
		const result = await client.sendBatch({
			messages: [
				{
					from: from!,
					to: to!,
					subject: `[ai-tools it] resend batch a ${Date.now()}`,
					text: 'batch a'
				},
				{
					from: from!,
					to: to!,
					subject: `[ai-tools it] resend batch b ${Date.now()}`,
					text: 'batch b'
				}
			]
		})
		expect(result).toBeDefined()
	})
})
