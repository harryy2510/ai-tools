import { describe, expect, test } from 'bun:test'

import { R2Client } from '../../../src/vendors/r2'
import { env, objectKey } from '../helpers'

const accountId = env('AI_TOOLS_R2_ACCOUNT_ID')
const apiToken = env('AI_TOOLS_R2_API_TOKEN')
const bucket = env('AI_TOOLS_R2_BUCKET')
const run = accountId && apiToken && bucket ? describe : describe.skip

run('live vendor r2', () => {
	test(
		'list put get head copy delete putBytes getBytes',
		async () => {
			const client = new R2Client({
				account_id: accountId!,
				api_token: apiToken!,
				bucket: bucket!
			})
			const key = objectKey('ai-tools-r2')
			const copyKey = `${key}.copy`

			await client.put({
				key,
				body: 'hello r2',
				body_encoding: 'utf8',
				content_type: 'text/plain'
			})
			const listed = await client.list({ prefix: 'ai-tools-r2', limit: 20 })
			expect(Array.isArray(listed.items)).toBe(true)

			const got = await client.get({ key })
			expect(got.body).toBeTruthy()

			const head = await client.head({ key })
			expect(head.key).toBe(key)

			await client.copy({ source_key: key, destination_key: copyKey })
			const copyGot = await client.get({ key: copyKey })
			expect(copyGot.body).toBeTruthy()

			const bytesKey = objectKey('ai-tools-r2-bytes')
			await client.putBytes(bytesKey, new TextEncoder().encode('bytes'), 'text/plain')
			const raw = await client.getBytes(bytesKey)
			expect(raw.byteLength).toBeGreaterThan(0)

			await client.delete({ key })
			await client.delete({ key: copyKey })
			await client.delete({ key: bytesKey })
		},
		{ timeout: 60_000 }
	)
})
