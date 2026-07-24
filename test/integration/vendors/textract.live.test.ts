import { describe, expect, test } from 'bun:test'

import { TextractClient } from '../../../src/vendors/textract'
import { env } from '../env'

// Do NOT fall back to AI_TOOLS_S3_* (those are MinIO for local IT).
const accessKeyId = env('AI_TOOLS_TEXTRACT_ACCESS_KEY_ID')
const secretAccessKey = env('AI_TOOLS_TEXTRACT_SECRET_ACCESS_KEY')
const region = env('AI_TOOLS_TEXTRACT_REGION')
const bucket = env('AI_TOOLS_TEXTRACT_BUCKET')
const sourceKey = env('AI_TOOLS_TEXTRACT_SOURCE_KEY')
const run = accessKeyId && secretAccessKey && region && bucket && sourceKey ? describe : describe.skip

run('live vendor textract', () => {
	test(
		'extractText from S3 object',
		async () => {
			const client = new TextractClient({
				access_key_id: accessKeyId!,
				secret_access_key: secretAccessKey!,
				region: region!,
				bucket: bucket!,
				poll_timeout_ms: 60_000
			})
			const result = await client.extractText({
				source: { store: 'object', key: sourceKey! }
			})
			expect(['succeeded', 'pending', 'failed']).toContain(result.status)
			if (result.status === 'succeeded') {
				expect(typeof result.text === 'string').toBe(true)
			}
		},
		{ timeout: 90_000 }
	)
})
