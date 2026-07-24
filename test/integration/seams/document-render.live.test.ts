import { describe, expect, test } from 'bun:test'

import { DocumentRenderClient } from '../../../src/modules/document-render'
import { env, s3AuthFromEnv } from '../helpers'

const gotenbergUrl = env('AI_TOOLS_GOTENBERG_BASE_URL')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const runG = gotenbergUrl && storage ? describe : describe.skip

const cfAccount = env('AI_TOOLS_CF_BROWSER_ACCOUNT_ID') ?? env('AI_TOOLS_CF_EMAIL_ACCOUNT_ID')
const cfToken = env('AI_TOOLS_CF_BROWSER_API_TOKEN')
const runCf = cfAccount && cfToken && storage ? describe : describe.skip

runG('live seam document-render (gotenberg)', () => {
	test('renderPdf + renderScreenshot', async () => {
		const client = DocumentRenderClient.fromAuth({
			provider: 'gotenberg',
			gotenberg_base_url: gotenbergUrl!,
			storage: storage!,
			...(env('AI_TOOLS_GOTENBERG_USER')
				? {
						gotenberg_api_username: env('AI_TOOLS_GOTENBERG_USER')!,
						gotenberg_api_password: env('AI_TOOLS_GOTENBERG_PASSWORD')!
					}
				: {})
		})
		const pdf = await client.renderPdf({
			source: { html: '<html><body><h1>document-render gotenberg</h1></body></html>' },
			filename: 'doc-render-g.pdf'
		})
		expect(pdf.kind).toBe('pdf')
		const shot = await client.renderScreenshot({
			source: { html: '<html><body><h1>document-render gotenberg shot</h1></body></html>' },
			filename: 'doc-render-g.png'
		})
		expect(shot.kind).toBe('screenshot')
	})
})

runCf('live seam document-render (cloudflare-browser)', () => {
	test('renderPdf + renderScreenshot', async () => {
		const client = DocumentRenderClient.fromAuth({
			provider: 'cloudflare-browser',
			account_id: cfAccount!,
			api_token: cfToken!,
			storage: storage!
		})
		const pdf = await client.renderPdf({
			source: { html: '<html><body><h1>document-render cf</h1></body></html>' },
			filename: 'doc-render-cf.pdf'
		})
		expect(pdf.kind).toBe('pdf')
		const shot = await client.renderScreenshot({
			source: { html: '<html><body><h1>document-render cf shot</h1></body></html>' },
			filename: 'doc-render-cf.png'
		})
		expect(shot.kind).toBe('screenshot')
	})
})
