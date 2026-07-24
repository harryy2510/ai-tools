import { describe, expect, test } from 'bun:test'

import { StorageClient } from '../../../src/modules/storage'
import { objectKey, s3AuthFromEnv } from '../helpers'

const s3 = s3AuthFromEnv('AI_TOOLS_S3')
const run = s3 ? describe : describe.skip

run('live seam storage (s3)', () => {
	test('put get delete', async () => {
		const client = StorageClient.fromAuth({ provider: 's3', ...s3! })
		const key = objectKey('storage-seam')
		await client.put({
			key,
			body: 'storage seam',
			body_encoding: 'utf8',
			content_type: 'text/plain'
		})
		const got = await client.get({ key })
		expect(got.body).toBeTruthy()
		await client.delete({ key })
	})
})
