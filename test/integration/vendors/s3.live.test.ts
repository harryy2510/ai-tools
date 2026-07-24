import { describe, expect, test } from 'bun:test'

import { S3Client } from '../../../src/vendors/s3'
import { objectKey, s3AuthFromEnv } from '../helpers'

const auth = s3AuthFromEnv('AI_TOOLS_S3')
const run = auth ? describe : describe.skip

run('live vendor s3', () => {
	test('put get delete object', async () => {
		const client = new S3Client(auth!)
		const key = objectKey('ai-tools-s3')
		await client.put({
			key,
			body: 'hello s3 integration',
			body_encoding: 'utf8',
			content_type: 'text/plain'
		})
		const got = await client.get({ key })
		expect(got.body).toBeTruthy()
		await client.delete({ key })
	})
})
