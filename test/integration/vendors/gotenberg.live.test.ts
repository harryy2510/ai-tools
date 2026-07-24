import { describe, expect, test } from 'bun:test'

import { GotenbergClient } from '../../../src/vendors/gotenberg'
import { env, s3AuthFromEnv } from '../helpers'

const baseUrl = env('AI_TOOLS_GOTENBERG_BASE_URL')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = baseUrl && storage ? describe : describe.skip

run('live vendor gotenberg', () => {
	test('renderPdf html to storage', async () => {
		const client = new GotenbergClient({
			gotenberg_base_url: baseUrl!,
			storage: storage!,
			...(env('AI_TOOLS_GOTENBERG_USER')
				? {
						gotenberg_api_username: env('AI_TOOLS_GOTENBERG_USER')!,
						gotenberg_api_password: env('AI_TOOLS_GOTENBERG_PASSWORD')!
					}
				: {})
		})
		const out = await client.renderPdf({
			source: { html: '<html><body><h1>ai-tools gotenberg it</h1></body></html>' },
			filename: 'gotenberg-it.pdf'
		})
		expect(out.kind).toBe('pdf')
		expect(out.result.key).toBeTruthy()
	})
})
