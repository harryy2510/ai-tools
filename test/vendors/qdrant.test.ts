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

	test('client upsert maps free-form ids to UUID', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('/collections/docs/points')
			expect(init?.method).toBe('PUT')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			const point = body.points?.[0]
			expect(point?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
			expect(point?.payload?.__logical_id).toBe('pt-not-a-uuid')
			return new Response(JSON.stringify({ result: { status: 'ok' } }), { status: 200 })
		})
		try {
			const client = new QdrantClient({
				base_url: 'https://qdrant.example',
				default_collection: 'docs'
			})
			const out = await client.upsert({
				vectors: [{ id: 'pt-not-a-uuid', values: [1, 2], metadata: { source: 't' } }]
			})
			expect(out.upserted).toBe(1)
		} finally {
			restore()
		}
	})

	test('client query restores logical id from payload', async () => {
		const restore = mockFetch(() => {
			return new Response(
				JSON.stringify({
					result: [
						{
							id: '11111111-1111-4111-8111-111111111111',
							score: 0.9,
							payload: { __logical_id: 'doc-1#0', text: 'hello' }
						}
					]
				}),
				{ status: 200 }
			)
		})
		try {
			const client = new QdrantClient({
				base_url: 'https://qdrant.example',
				default_collection: 'docs'
			})
			const out = await client.query({ vector: [1, 2], top_k: 1 })
			expect(out.matches[0]?.id).toBe('doc-1#0')
			expect(out.matches[0]?.metadata).toEqual({ text: 'hello' })
		} finally {
			restore()
		}
	})
})
