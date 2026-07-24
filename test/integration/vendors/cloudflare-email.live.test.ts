import { describe, expect, test } from 'bun:test'

import { CloudflareEmailClient } from '../../../src/vendors/cloudflare-email'
import { env } from '../env'

const apiToken = env('AI_TOOLS_CF_EMAIL_API_TOKEN')
const accountId = env('AI_TOOLS_CF_EMAIL_ACCOUNT_ID')
const from = env('AI_TOOLS_CF_EMAIL_FROM')
const to = env('AI_TOOLS_CF_EMAIL_TO')
const run = apiToken && accountId && from && to ? describe : describe.skip

run('live vendor cloudflare-email', () => {
	test('send text email', async () => {
		const client = new CloudflareEmailClient({
			api_token: apiToken!,
			account_id: accountId!
		})
		const result = await client.send({
			from: from!,
			to: to!,
			subject: `[ai-tools it] cf-email ${Date.now()}`,
			text: 'ai-tools integration test (cloudflare-email)'
		})
		expect(result).toBeDefined()
	})
})
