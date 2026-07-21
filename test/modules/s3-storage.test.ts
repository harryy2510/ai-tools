import { describe, expect, test } from 'bun:test'

import { runTool, validateModule, withAuth } from '../../src/core'
import { listObjectsTool, s3StorageModule } from '../../src/modules/s3-storage'

function requestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input
	if (input instanceof URL) return input.href
	return input.url
}

describe('s3-storage', () => {
	test('passes contracts', () => {
		expect(validateModule(s3StorageModule).ok).toBe(true)
	})

	test('listObjects parses ListObjectsV2 XML', async () => {
		const bound = withAuth(s3StorageModule, {
			accessKeyId: 'AKIAtest',
			secretAccessKey: 'secret',
			region: 'auto',
			bucket: 'my-bucket',
			endpoint: 'https://example.r2.cloudflarestorage.com'
		})
		const tool = bound.tools.find((t) => t.id === listObjectsTool.id)
		if (!tool) throw new Error('expected list tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = requestUrl(input)
			expect(url).toContain('my-bucket')
			expect(url).toContain('list-type=2')
			return new Response(
				`<?xml version="1.0"?>
				<ListBucketResult>
					<Key>a.txt</Key>
					<Key>b.txt</Key>
					<IsTruncated>false</IsTruncated>
				</ListBucketResult>`,
				{ status: 200 }
			)
		}) as typeof globalThis.fetch

		try {
			const result = await runTool(tool, { prefix: 'docs/' })
			expect(result).toEqual({
				keys: ['a.txt', 'b.txt'],
				is_truncated: false
			})
		} finally {
			globalThis.fetch = original
		}
	})
})
