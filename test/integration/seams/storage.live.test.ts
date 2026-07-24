import { describe, expect, test } from 'bun:test'

import { StorageClient } from '../../../src/modules/storage'
import { env, objectKey, s3AuthFromEnv } from '../helpers'

const s3 = s3AuthFromEnv('AI_TOOLS_S3')
const r2Account = env('AI_TOOLS_R2_ACCOUNT_ID')
const r2Token = env('AI_TOOLS_R2_API_TOKEN')
const r2Bucket = env('AI_TOOLS_R2_BUCKET')
const supabaseUrl = env('AI_TOOLS_SUPABASE_URL')
const supabaseKey = env('AI_TOOLS_SUPABASE_SERVICE_ROLE_KEY') ?? env('AI_TOOLS_SUPABASE_API_KEY')
const supabaseBucket = env('AI_TOOLS_SUPABASE_STORAGE_BUCKET') ?? 'ai-tools-it'

const runS3 = s3 ? describe : describe.skip
const runR2 = r2Account && r2Token && r2Bucket ? describe : describe.skip
const runSb = supabaseUrl && supabaseKey ? describe : describe.skip

async function roundTrip(client: StorageClient, prefix: string) {
	const key = objectKey(prefix)
	const copyKey = `${key}.copy`
	await client.put({
		key,
		body: `storage seam ${prefix}`,
		body_encoding: 'utf8',
		content_type: 'text/plain'
	})
	const listed = await client.list({ prefix: prefix, limit: 20 })
	expect(Array.isArray(listed.items)).toBe(true)
	const got = await client.get({ key })
	expect(got.body).toBeTruthy()
	const head = await client.head({ key })
	expect(head.exists).toBe(true)
	await client.copy({ source_key: key, destination_key: copyKey })
	const bytesKey = objectKey(`${prefix}-bytes`)
	await client.putBytes(bytesKey, new TextEncoder().encode('bytes'), 'text/plain')
	const raw = await client.getBytes(bytesKey)
	expect(raw.byteLength).toBeGreaterThan(0)
	await client.delete({ key })
	await client.delete({ key: copyKey })
	await client.delete({ key: bytesKey })
}

runS3('live seam storage (s3)', () => {
	test('full object surface', async () => {
		await roundTrip(StorageClient.fromAuth({ provider: 's3', ...s3! }), 'storage-s3')
	})
})

runR2('live seam storage (r2)', () => {
	test('full object surface', async () => {
		await roundTrip(
			StorageClient.fromAuth({
				provider: 'r2',
				account_id: r2Account!,
				api_token: r2Token!,
				bucket: r2Bucket!
			}),
			'storage-r2'
		)
	})
})

runSb('live seam storage (supabase)', () => {
	test('full object surface', async () => {
		await roundTrip(
			StorageClient.fromAuth({
				provider: 'supabase',
				url: supabaseUrl!,
				service_role_key: supabaseKey!,
				bucket: supabaseBucket
			}),
			'storage-sb'
		)
	})
})
