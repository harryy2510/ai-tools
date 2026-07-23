import { describe, expect, test } from 'bun:test'

import { runTool, validateModule, withAuth } from '../../src/core'
import { RagClient, chunkText, ragModule } from '../../src/modules/rag'

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

const auth = {
	vector_store: {
		provider: 'qdrant' as const,
		base_url: 'https://qdrant.example',
		default_collection: 'knowledge'
	},
	embed: {
		base_url: 'https://embed.example/v1',
		api_key: 'ek',
		model: 'text-embedding-3-small'
	}
}

describe('rag', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(ragModule).ok).toBe(true)
		expect(ragModule.tools.map((t) => t.id).sort()).toEqual(['rag-delete', 'rag-ingest', 'rag-retrieve'])
	})

	test('chunkText splits long input with overlap', () => {
		const text = 'a'.repeat(2500)
		const chunks = chunkText(text, { max_chars: 1000, overlap: 100 })
		expect(chunks.length).toBeGreaterThan(2)
		expect(chunks[0]?.length).toBeLessThanOrEqual(1000)
	})

	test('ingest embeds batches then upserts', async () => {
		const seen: string[] = []
		const restore = mockFetch((url, init) => {
			seen.push(url)
			if (url.includes('/embeddings')) {
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
				const input = Array.isArray(body.input) ? body.input : []
				return new Response(
					JSON.stringify({
						data: input.map((_: unknown, index: number) => ({
							index,
							embedding: [0.1, 0.2, index]
						}))
					}),
					{ status: 200 }
				)
			}
			if (url.includes('/collections/knowledge/points')) {
				return new Response(JSON.stringify({ result: { status: 'ok' } }), { status: 200 })
			}
			return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
		})

		try {
			const client = RagClient.fromAuth(auth)
			const result = await client.ingest({
				document_id: 'doc-1',
				text: 'Hello knowledge base. This is a short document.'
			})
			expect(result.document_id).toBe('doc-1')
			expect(result.chunk_count).toBe(1)
			expect(result.chunk_ids).toEqual(['doc-1#0'])
			expect(seen.some((u) => u.includes('/embeddings'))).toBe(true)
			expect(seen.some((u) => u.includes('/collections/knowledge/points'))).toBe(true)
		} finally {
			restore()
		}
	})

	test('retrieve embeds query and maps metadata text', async () => {
		const restore = mockFetch((url) => {
			if (url.includes('/embeddings')) {
				return new Response(JSON.stringify({ data: [{ index: 0, embedding: [0.5, 0.5] }] }), { status: 200 })
			}
			if (url.includes('/points/search')) {
				return new Response(
					JSON.stringify({
						result: [
							{
								id: 'doc-1#0',
								score: 0.88,
								payload: { text: 'Hello knowledge base.', document_id: 'doc-1', chunk_index: 0 }
							}
						]
					}),
					{ status: 200 }
				)
			}
			return new Response(JSON.stringify({ error: 'nope' }), { status: 404 })
		})

		try {
			const bound = withAuth(ragModule, auth)
			const tool = bound.tools.find((t) => t.id === 'rag-retrieve')
			if (!tool) throw new Error('missing tool')
			const result = await runTool(tool, { query: 'hello', top_k: 3 })
			expect(result).toEqual({
				matches: [
					{
						id: 'doc-1#0',
						score: 0.88,
						text: 'Hello knowledge base.',
						document_id: 'doc-1',
						chunk_index: 0,
						metadata: {
							text: 'Hello knowledge base.',
							document_id: 'doc-1',
							chunk_index: 0
						}
					}
				],
				collection: 'knowledge'
			})
		} finally {
			restore()
		}
	})
})
