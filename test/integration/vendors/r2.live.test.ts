import { describe, expect, test } from 'bun:test'

import { R2Client } from '../../../src/vendors/r2'
import { env, objectKey } from '../helpers'

const accountId = env('AI_TOOLS_R2_ACCOUNT_ID')
const apiToken = env('AI_TOOLS_R2_API_TOKEN')
const bucket = env('AI_TOOLS_R2_BUCKET')
const run = accountId && apiToken && bucket ? describe : describe.skip

run('live vendor r2', () => {
	test('put get delete object', async () => {
		const client = new R2Client({
			account_id: accountId!,
			api_token: apiToken!,
			bucket: bucket!
		})
		const key = objectKey('ai-tools-r2')
		await client.put({
			key,
			body: 'hello r2',
			body_encoding: 'utf8',
			content_type: 'text/plain'
		})
		const got = await client.get({ key })
		expect(got.body).toBeTruthy()
		await client.delete({ key })
	})
})
