import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { R2Client, r2Module } from '../../src/vendors/r2'

describe('r2', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(r2Module).ok).toBe(true)
		expect(r2Module.auth.type).toBe('custom')
		expect(r2Module.tools.map((t) => t.id).sort()).toEqual([
			'r2-copy-object',
			'r2-delete-object',
			'r2-get-object',
			'r2-head-object',
			'r2-list-objects',
			'r2-put-object'
		])
	})

	test('invalid auth rejected at construct', () => {
		expect(
			() =>
				new R2Client({
					account_id: '',
					api_token: 'token',
					bucket: 'media'
				})
		).toThrow()
		expect(
			() =>
				new R2Client({
					account_id: 'acc',
					api_token: '',
					bucket: 'media'
				})
		).toThrow()
	})
})
