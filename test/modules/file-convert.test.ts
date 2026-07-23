import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { fileConvertModule, fileConvertTool } from '../../src/modules/file-convert'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('file-convert', () => {
	test('passes contracts', () => {
		expect(validateModule(fileConvertModule).ok).toBe(true)
		expect(fileConvertTool.id).toBe('file-convert')
		expect(fileConvertTool.meta.sideEffect).toBe('write')
		expect(fileConvertModule.tools.some((t) => t.id === 'file-convert-batch')).toBe(true)
	})

	test('transmute provider converts and writes result', async () => {
		const bound = withAuth(fileConvertModule, {
			provider: 'transmute',
			transmute_base_url: 'https://transmute.example',
			transmute_token: 'tok',
			storage: {
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'auto',
				bucket: 'artifacts',
				endpoint: 'https://example.r2.cloudflarestorage.com'
			}
		})
		const tool = bound.tools[0]
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')

			if (url.includes('artifacts') && url.includes('in.md') && method === 'GET') {
				return new Response('# hi', { status: 200 })
			}
			if (url.includes('transmute.example') && url.endsWith('/api/files') && method === 'POST') {
				return new Response(
					JSON.stringify({
						message: 'ok',
						metadata: {
							id: 'src-1',
							storage_path: '/data/src-1.md',
							original_filename: 'in.md',
							media_type: 'md',
							extension: 'md',
							size_bytes: 4,
							sha256_checksum: 'x',
							user_id: 'u',
							compatible_formats: { pdf: [] }
						}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			}
			if (url.includes('/api/conversions') && method === 'POST') {
				const body = typeof init?.body === 'string' ? init.body : ''
				expect(body).toContain('src-1')
				expect(body).toContain('pdf')
				return new Response(
					JSON.stringify({
						id: 'out-1',
						storage_path: '/data/out-1.pdf',
						original_filename: 'in.pdf',
						media_type: 'pdf',
						extension: 'pdf',
						size_bytes: 3,
						sha256_checksum: 'y',
						user_id: 'u',
						compatible_formats: {}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			}
			if (url.includes('/api/files/out-1') && method === 'GET') {
				return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
			}
			if (url.includes('artifacts') && method === 'PUT') {
				expect(url).toContain('in.pdf')
				return new Response(null, { status: 200 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					source: { store: 'object', key: 'docs/in.md', filename: 'in.md', media_type: 'md' },
					output_format: 'pdf'
				})
			)
			expect(result['provider_source_id']).toBe('src-1')
			expect(result['provider_result_id']).toBe('out-1')
			const out = result['result']
			expect(isPlainObject(out)).toBe(true)
			if (isPlainObject(out)) {
				expect(out['store']).toBe('object')
				expect(out['key']).toBe('docs/in.pdf')
				expect(out['byte_length']).toBe(3)
			}
		} finally {
			globalThis.fetch = original
		}
	})
})
