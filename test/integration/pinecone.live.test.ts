/**
 * Live Pinecone data-plane: upsert → query → delete.
 *
 * Env:
 *   AI_TOOLS_PINECONE_API_KEY=
 *   AI_TOOLS_PINECONE_BASE_URL=https://xxxx.svc.….pinecone.io
 *   AI_TOOLS_PINECONE_NAMESPACE=ai-tools-it  (optional)
 *   AI_TOOLS_PINECONE_DIMENSION=512          (must match the index; default 512)
 *
 * Index must already exist with that dimension.
 */

import { describe, test } from 'bun:test'

import { PineconeClient } from '../../src/vendors/pinecone'
import { VectorStoreClient } from '../../src/modules/vector-store'
import { assertUpsertQueryDeleteRoundTrip, env } from './helpers'

const apiKey = env('AI_TOOLS_PINECONE_API_KEY')
const baseUrl = env('AI_TOOLS_PINECONE_BASE_URL')
const namespace = env('AI_TOOLS_PINECONE_NAMESPACE')
const dim = Number(env('AI_TOOLS_PINECONE_DIMENSION') ?? '512')
const run = apiKey && baseUrl ? describe : describe.skip

function sample(dimN: number): number[] {
	const out: number[] = []
	for (let i = 0; i < dimN; i += 1) out.push(0.1 + i * 0.01)
	return out
}

run('integration pinecone', () => {
	const values = sample(Number.isFinite(dim) && dim > 0 ? dim : 512)

	test('vendor client round-trip', async () => {
		if (!apiKey || !baseUrl) return
		const client = new PineconeClient({
			api_key: apiKey,
			base_url: baseUrl,
			...(namespace ? { default_namespace: namespace } : {})
		})
		await assertUpsertQueryDeleteRoundTrip(client, {
			values,
			...(namespace ? { namespace } : {})
		})
	})

	test('vector-store seam provider=pinecone', async () => {
		if (!apiKey || !baseUrl) return
		const client = VectorStoreClient.fromAuth({
			provider: 'pinecone',
			api_key: apiKey,
			base_url: baseUrl,
			...(namespace ? { default_namespace: namespace } : {})
		})
		await assertUpsertQueryDeleteRoundTrip(client, {
			values,
			...(namespace ? { namespace } : {})
		})
	})
})
