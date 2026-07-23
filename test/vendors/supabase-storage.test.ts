import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { SupabaseStorageClient, supabaseStorageModule } from '../../src/vendors/supabase-storage'

describe('supabase-storage', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(supabaseStorageModule).ok).toBe(true)
		expect(supabaseStorageModule.auth.type).toBe('custom')
		expect(supabaseStorageModule.tools.map((t) => t.id).sort()).toEqual([
			'supabase-storage-copy-object',
			'supabase-storage-delete-object',
			'supabase-storage-get-object',
			'supabase-storage-head-object',
			'supabase-storage-list-objects',
			'supabase-storage-put-object'
		])
	})

	test('invalid auth rejected at construct', () => {
		expect(
			() =>
				new SupabaseStorageClient({
					url: 'https://xyz.supabase.co',
					service_role_key: '',
					bucket: 'media'
				})
		).toThrow()
		expect(
			() =>
				new SupabaseStorageClient({
					url: 'not-a-url',
					service_role_key: 'key',
					bucket: 'media'
				})
		).toThrow()
	})
})
