import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { QdrantClient, qdrantModule } from '../../src/vendors/qdrant'

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		return handler(url, init)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

describe('qdrant vendor', () => {
	test('module tool ids', () => {
		expect(validateModule(qdrantModule).ok).toBe(true)
		expect(qdrantModule.tools.map((t) => t.id).sort()).toEqual(['qdrant-delete', 'qdrant-query', 'qdrant-upsert'])
	})

	test('client upsert', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('/collections/docs/points')
			expect(init?.method).toBe('PUT')
			return new Response(JSON.stringify({ result: { status: 'ok' } }), { status: 200 })
		})
		try {
			const client = new QdrantClient({
				base_url: 'https://qdrant.example',
				default_collection: 'docs'
			})
			const out = await client.upsert({
				vectors: [{ id: 'a', values: [1, 2] }]
			})
			expect(out.upserted).toBe(1)
		} finally {
			restore()
		}
	})
})
