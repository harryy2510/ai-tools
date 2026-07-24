import { describe, expect, test } from 'bun:test'

import { FileConvertClient } from '../../../src/modules/file-convert'
import { S3Client } from '../../../src/vendors/s3'
import { env, objectKey, s3AuthFromEnv } from '../helpers'

const baseUrl = env('AI_TOOLS_TRANSMUTE_BASE_URL')
const token = env('AI_TOOLS_TRANSMUTE_TOKEN')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = baseUrl && token && storage ? describe : describe.skip

run('live seam file-convert (transmute)', () => {
	test('convert', async () => {
		const s3 = new S3Client(storage!)
		const sourceKey = objectKey('file-convert-src')
		await s3.put({
			key: sourceKey,
			body: '# File convert seam\n',
			body_encoding: 'utf8',
			content_type: 'text/markdown'
		})
		const client = FileConvertClient.fromAuth({
			provider: 'transmute',
			transmute_base_url: baseUrl!,
			transmute_token: token!,
			storage: storage!
		})
		const out = await client.convert({
			source: { store: 'object', key: sourceKey, media_type: 'text/markdown' },
			output_format: 'pdf'
		})
		expect(out.result.key).toBeTruthy()
		await s3.delete({ key: sourceKey }).catch(() => undefined)
	})
})
