import { describe, expect, test } from 'bun:test'

import { VectorStoreClient } from '../../../src/modules/vector-store'
import { QdrantClient } from '../../../src/vendors/qdrant'
import { assertUpsertQueryDeleteRoundTrip, ensureQdrantCollection, env, sampleVectorA } from '../helpers'

const baseUrl = env('AI_TOOLS_QDRANT_URL')
const apiKey = env('AI_TOOLS_QDRANT_API_KEY')
const collection = env('AI_TOOLS_QDRANT_COLLECTION') ?? 'ai_tools_it'
const run = baseUrl ? describe : describe.skip

run('live vendor qdrant', () => {
	test('client round-trip', async () => {
		if (!baseUrl) return
		await ensureQdrantCollection({
			baseUrl,
			apiKey,
			collection,
			dimension: sampleVectorA.length
		})
		const client = new QdrantClient({
			base_url: baseUrl,
			default_collection: collection,
			...(apiKey ? { api_key: apiKey } : {})
		})
		await assertUpsertQueryDeleteRoundTrip(client)
	})

	test('seam vector-store provider=qdrant', async () => {
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
