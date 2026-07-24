import { describe, expect, test } from 'bun:test'

import { SupabaseStorageClient } from '../../../src/vendors/supabase-storage'
import { env, objectKey } from '../helpers'

const url = env('AI_TOOLS_SUPABASE_URL')
const serviceRoleKey = env('AI_TOOLS_SUPABASE_SERVICE_ROLE_KEY') ?? env('AI_TOOLS_SUPABASE_API_KEY')
const bucket = env('AI_TOOLS_SUPABASE_STORAGE_BUCKET') ?? 'ai-tools-it'
const run = url && serviceRoleKey && bucket ? describe : describe.skip

run('live vendor supabase-storage', () => {
	test('list put get head copy delete putBytes getBytes', async () => {
		const client = new SupabaseStorageClient({
			url: url!,
			service_role_key: serviceRoleKey!,
			bucket: bucket!
		})
		const key = objectKey('ai-tools-sb')
		const copyKey = `${key}.copy`

		await client.put({
			key,
			body: 'hello supabase storage',
			body_encoding: 'utf8',
			content_type: 'text/plain'
		})
		const listed = await client.list({ prefix: 'ai-tools-sb', limit: 20 })
		expect(Array.isArray(listed.items)).toBe(true)

		const got = await client.get({ key })
		expect(got.body).toBeTruthy()

		const head = await client.head({ key })
		expect(head.key).toBe(key)

		await client.copy({ source_key: key, destination_key: copyKey })
		const copyGot = await client.get({ key: copyKey })
		expect(copyGot.body).toBeTruthy()

		const bytesKey = objectKey('ai-tools-sb-bytes')
		await client.putBytes(bytesKey, new TextEncoder().encode('bytes'), 'text/plain')
		const raw = await client.getBytes(bytesKey)
		expect(raw.byteLength).toBeGreaterThan(0)

		await client.delete({ key })
		await client.delete({ key: copyKey })
		await client.delete({ key: bytesKey })
	})
})
