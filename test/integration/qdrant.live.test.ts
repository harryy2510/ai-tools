/**
 * Live Qdrant: upsert → query → delete.
 *
 * Env:
 *   AI_TOOLS_QDRANT_URL=http://127.0.0.1:6333
 *   AI_TOOLS_QDRANT_API_KEY=   (optional)
 *   AI_TOOLS_QDRANT_COLLECTION=ai_tools_it  (optional; created if missing)
 */

import { describe, expect, test } from 'bun:test'

import { QdrantClient } from '../../src/vendors/qdrant'
import { VectorStoreClient } from '../../src/modules/vector-store'
import { assertUpsertQueryDeleteRoundTrip, ensureQdrantCollection, env, sampleVectorA } from './helpers'

const baseUrl = env('AI_TOOLS_QDRANT_URL')
const apiKey = env('AI_TOOLS_QDRANT_API_KEY')
const collection = env('AI_TOOLS_QDRANT_COLLECTION') ?? 'ai_tools_it'
const run = baseUrl ? describe : describe.skip

run('integration qdrant', () => {
	test('vendor client round-trip', async () => {
		if (!baseUrl) return
		await ensureQdrantCollection({
			baseUrl,
			apiKey,
			collection,
			dimension: sampleVectorA.length
		})
		const auth = {
			base_url: baseUrl,
			default_collection: collection,
			...(apiKey ? { api_key: apiKey } : {})
		}
		const client = new QdrantClient(auth)
		await assertUpsertQueryDeleteRoundTrip(client)
	})

	test('vector-store seam provider=qdrant', async () => {
		if (!baseUrl) return
		await ensureQdrantCollection({
			baseUrl,
			apiKey,
			collection,
			dimension: sampleVectorA.length
		})
		const client = VectorStoreClient.fromAuth({
			provider: 'qdrant',
			base_url: baseUrl,
			default_collection: collection,
			...(apiKey ? { api_key: apiKey } : {})
		})
		await assertUpsertQueryDeleteRoundTrip(client)
		expect(true).toBe(true)
	})
})
