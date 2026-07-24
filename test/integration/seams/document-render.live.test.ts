import { describe, expect, test } from 'bun:test'

import { DocumentRenderClient } from '../../../src/modules/document-render'
import { env, s3AuthFromEnv } from '../helpers'

const baseUrl = env('AI_TOOLS_GOTENBERG_BASE_URL')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = baseUrl && storage ? describe : describe.skip

run('live seam document-render (gotenberg)', () => {
	test('renderPdf', async () => {
		const client = DocumentRenderClient.fromAuth({
			provider: 'gotenberg',
			gotenberg_base_url: baseUrl!,
			storage: storage!
		})
		const out = await client.renderPdf({
			source: { html: '<html><body>document-render seam</body></html>' }
		})
		expect(out.result.key).toBeTruthy()
	})
})
