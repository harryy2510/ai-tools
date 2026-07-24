import { describe, expect, test } from 'bun:test'

import { SupabaseStorageClient } from '../../../src/vendors/supabase-storage'
import { env, objectKey } from '../helpers'

const url = env('AI_TOOLS_SUPABASE_URL')
const serviceRoleKey = env('AI_TOOLS_SUPABASE_SERVICE_ROLE_KEY') ?? env('AI_TOOLS_SUPABASE_API_KEY')
const bucket = env('AI_TOOLS_SUPABASE_STORAGE_BUCKET')
const run = url && serviceRoleKey && bucket ? describe : describe.skip

run('live vendor supabase-storage', () => {
	test('put get delete object', async () => {
		const client = new SupabaseStorageClient({
			url: url!,
			service_role_key: serviceRoleKey!,
			bucket: bucket!
		})
		const key = objectKey('ai-tools-sb')
		await client.put({
			key,
			body: 'hello supabase storage',
			body_encoding: 'utf8',
			content_type: 'text/plain'
		})
		const got = await client.get({ key })
		expect(got.body).toBeTruthy()
		await client.delete({ key })
	})
})
