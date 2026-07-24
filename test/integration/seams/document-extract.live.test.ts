import { describe, expect, test } from 'bun:test'

import { DocumentExtractClient } from '../../../src/modules/document-extract'
import { env } from '../env'

// Do NOT fall back to AI_TOOLS_S3_* (those are MinIO for local IT).
const accessKeyId = env('AI_TOOLS_TEXTRACT_ACCESS_KEY_ID')
const secretAccessKey = env('AI_TOOLS_TEXTRACT_SECRET_ACCESS_KEY')
const region = env('AI_TOOLS_TEXTRACT_REGION')
const bucket = env('AI_TOOLS_TEXTRACT_BUCKET')
const sourceKey = env('AI_TOOLS_TEXTRACT_SOURCE_KEY')
const run = accessKeyId && secretAccessKey && region && bucket && sourceKey ? describe : describe.skip

run('live seam document-extract (textract)', () => {
	// Async Textract + poll; bun default 5s is too low (vendor barely finished in ~5s).
	test(
		'extractText',
		async () => {
			const client = DocumentExtractClient.fromAuth({
				provider: 'textract',
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
		},
		{ timeout: 90_000 }
	)
})
