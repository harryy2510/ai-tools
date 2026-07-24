import { describe, expect, test } from 'bun:test'

import { FilesClient } from '../../../src/modules/files'
import { uniqueId } from '../env'
import { s3AuthFromEnv } from '../helpers'

const s3 = s3AuthFromEnv('AI_TOOLS_S3')
const run = s3 ? describe : describe.skip

run('live seam files', () => {
	test('put get delete under root_prefix', async () => {
		const client = FilesClient.fromAuth({
			storage: { provider: 's3', ...s3! },
			root_prefix: 'ai-tools-files-it'
		})
		const path = `${uniqueId('f')}.txt`
		await client.put({
			path,
			body: 'files seam',
			body_encoding: 'utf8',
			content_type: 'text/plain'
		})
		const got = await client.get({ path })
		expect(got.body).toBeTruthy()
		await client.delete({ path })
	})
})
