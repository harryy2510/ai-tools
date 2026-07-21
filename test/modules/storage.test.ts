import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { storageModule } from '../../src/modules/storage'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('storage', () => {
	test('passes contracts', () => {
		expect(validateModule(storageModule).ok).toBe(true)
		expect(storageModule.id).toBe('storage')
		expect(storageModule.tools.some((t) => t.id === 'storage-list-objects')).toBe(true)
		expect(storageModule.tools.some((t) => t.id === 'storage-get-objects')).toBe(true)
		expect(storageModule.auth.type).toBe('custom')
	})

	test('s3 provider lists and gets objects (S3-compatible / R2 S3 endpoint)', async () => {
		const bound = withAuth(storageModule, {
			provider: 's3',
			accessKeyId: 'AKIAtest',
			secretAccessKey: 'secret',
			region: 'auto',
			bucket: 'artifacts',
			endpoint: 'https://example.r2.cloudflarestorage.com'
		})
		const listTool = bound.tools.find((t) => t.id === 'storage-list-objects')
		const getTool = bound.tools.find((t) => t.id === 'storage-get-object')
		if (!listTool || !getTool) throw new Error('missing tools')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			if (url.includes('list-type=2') || (method === 'GET' && url.includes('artifacts') && !url.includes('/docs/'))) {
				return new Response(
					`<?xml version="1.0"?>
					<ListBucketResult>
						<Contents><Key>docs/a.md</Key><Size>3</Size><LastModified>2020-01-01T00:00:00.000Z</LastModified><ETag>&quot;abc&quot;</ETag></Contents>
						<IsTruncated>false</IsTruncated>
					</ListBucketResult>`,
					{ status: 200 }
				)
			}
			if (method === 'GET' && url.includes('docs/a.md')) {
				return new Response('hi', {
					status: 200,
					headers: { 'content-type': 'text/plain', 'content-length': '2' }
				})
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const listed = asRecord(await runTool(listTool, { prefix: 'docs/' }))
			expect(listed['truncated']).toBe(false)
			expect(listed['keys']).toEqual(['docs/a.md'])

			const got = asRecord(await runTool(getTool, { key: 'docs/a.md', encoding: 'utf8' }))
			expect(got['body']).toBe('hi')
			expect(got['encoding']).toBe('utf8')
		} finally {
			globalThis.fetch = original
		}
	})

	test('r2 REST provider lists objects via api.cloudflare.com', async () => {
		const bound = withAuth(storageModule, {
			provider: 'r2',
			accountId: 'acc123',
			apiToken: 'cf_token',
			bucket: 'media'
		})
		const listTool = bound.tools.find((t) => t.id === 'storage-list-objects')
		if (!listTool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			expect(url).toContain('api.cloudflare.com/client/v4/accounts/acc123/r2/buckets/media/objects')
			expect(method).toBe('GET')
			return new Response(
				JSON.stringify({
					success: true,
					result: [
						{
							key: 'docs/a.md',
							size: 3,
							etag: 'abc',
							last_modified: '2020-01-01T00:00:00.000Z'
						}
					],
					result_info: { is_truncated: false, per_page: 20 }
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		}) as typeof globalThis.fetch

		try {
			const listed = asRecord(await runTool(listTool, { prefix: 'docs/' }))
			expect(listed['truncated']).toBe(false)
			expect(listed['keys']).toEqual(['docs/a.md'])
		} finally {
			globalThis.fetch = original
		}
	})
})
