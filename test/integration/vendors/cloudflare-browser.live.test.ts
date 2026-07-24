import { describe, expect, test } from 'bun:test'

import { CloudflareBrowserClient } from '../../../src/vendors/cloudflare-browser'
import { env, s3AuthFromEnv } from '../helpers'

const accountId = env('AI_TOOLS_CF_BROWSER_ACCOUNT_ID') ?? env('AI_TOOLS_CF_EMAIL_ACCOUNT_ID')
const apiToken = env('AI_TOOLS_CF_BROWSER_API_TOKEN')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = accountId && apiToken && storage ? describe : describe.skip

run('live vendor cloudflare-browser', () => {
	test('renderPdf html to storage', async () => {
		const client = new CloudflareBrowserClient({
			account_id: accountId!,
			api_token: apiToken!,
			storage: storage!
		})
		const out = await client.renderPdf({
			source: { html: '<html><body><h1>ai-tools cf browser it</h1></body></html>' },
			filename: 'cf-browser-it.pdf'
		})
		expect(out.kind).toBe('pdf')
		expect(out.result.key).toBeTruthy()
	})
})
