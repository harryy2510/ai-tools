import { describe, expect, test } from 'bun:test'
import { isPlainObject, isString } from 'es-toolkit'

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
	})

	test('s3 provider lists and gets objects', async () => {
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

	test('r2 provider uses ctx.extras.r2Buckets', async () => {
		const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>()
		objects.set('x.txt', { bytes: new TextEncoder().encode('hello'), contentType: 'text/plain' })

		const fakeBucket = {
			async get(key: string) {
				const hit = objects.get(key)
				if (hit === undefined) return null
				return {
					key,
					size: hit.bytes.byteLength,
					etag: 'e1',
					httpMetadata: hit.contentType === undefined ? undefined : { contentType: hit.contentType },
					arrayBuffer: async () => {
						const copy = new ArrayBuffer(hit.bytes.byteLength)
						new Uint8Array(copy).set(hit.bytes)
						return copy
					}
				}
			},
			async put(key: string, value: ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }) {
				const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)
				objects.set(key, {
					bytes,
					...(options?.httpMetadata?.contentType === undefined ? {} : { contentType: options.httpMetadata.contentType })
				})
				return { key, size: bytes.byteLength, etag: 'e2', arrayBuffer: async () => value }
			},
			async delete(key: string | string[]) {
				for (const k of Array.isArray(key) ? key : [key]) objects.delete(k)
			},
			async head(key: string) {
				const hit = objects.get(key)
				if (hit === undefined) return null
				return {
					key,
					size: hit.bytes.byteLength,
					etag: 'e1',
					httpMetadata: hit.contentType === undefined ? undefined : { contentType: hit.contentType },
					arrayBuffer: async () => new ArrayBuffer(0)
				}
			},
			async list() {
				return {
					objects: [...objects.entries()].map(([key, v]) => ({
						key,
						size: v.bytes.byteLength,
						etag: 'e1',
						arrayBuffer: async () => new ArrayBuffer(0)
					})),
					truncated: false
				}
			}
		}

		const bound = withAuth(storageModule, { provider: 'r2', bucket: 'assets' })
		const getTool = bound.tools.find((t) => t.id === 'storage-get-object')
		if (!getTool) throw new Error('missing tool')

		const got = asRecord(
			await runTool(getTool, { key: 'x.txt', encoding: 'utf8' }, { extras: { r2Buckets: { assets: fakeBucket } } })
		)
		expect(got['body']).toBe('hello')
		expect(isString(got['body'])).toBe(true)
	})
})
