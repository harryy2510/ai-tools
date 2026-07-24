/**
 * Seam-only matrix: each vector-store provider (when env present).
 * Vendor-specific round-trips also live under test/integration/vendors/*.
 */

import { describe, test } from 'bun:test'

import { VectorStoreClient } from '../../../src/modules/vector-store'
import {
	assertLocalUrl,
	assertUpsertQueryDeleteRoundTrip,
	ensureQdrantCollection,
	env,
	sampleVectorA,
	uniqueId
} from '../helpers'

const qdrantUrl = env('AI_TOOLS_QDRANT_URL')
const qdrantKey = env('AI_TOOLS_QDRANT_API_KEY')
const qdrantCollection = env('AI_TOOLS_QDRANT_COLLECTION') ?? 'ai_tools_it'

const pineconeKey = env('AI_TOOLS_PINECONE_API_KEY')
const pineconeBase = env('AI_TOOLS_PINECONE_BASE_URL')
const pineconeNs = env('AI_TOOLS_PINECONE_NAMESPACE')
const pineconeDim = Number(env('AI_TOOLS_PINECONE_DIMENSION') ?? '512')

const supabaseUrl = env('AI_TOOLS_SUPABASE_URL')
const supabaseKey = env('AI_TOOLS_SUPABASE_API_KEY')
const supabaseTable = env('AI_TOOLS_SUPABASE_VECTOR_TABLE') ?? 'ai_tools_vectors'

const mastraDb = env('AI_TOOLS_MASTRA_DB_URL')
const mastraSchema = env('AI_TOOLS_MASTRA_SCHEMA')

const runQ = qdrantUrl ? describe : describe.skip
const runP = pineconeKey && pineconeBase ? describe : describe.skip
const runS = supabaseUrl && supabaseKey ? describe : describe.skip
const runM = mastraDb ? describe : describe.skip

runQ('live seam vector-store qdrant', () => {
	test('round-trip', async () => {
		await ensureQdrantCollection({
			baseUrl: qdrantUrl!,
			apiKey: qdrantKey,
			collection: qdrantCollection,
			dimension: sampleVectorA.length
		})
		await assertUpsertQueryDeleteRoundTrip(
			VectorStoreClient.fromAuth({
				provider: 'qdrant',
				base_url: qdrantUrl!,
				default_collection: qdrantCollection,
				...(qdrantKey ? { api_key: qdrantKey } : {})
			})
		)
	})
})

runP('live seam vector-store pinecone', () => {
	test(
		'round-trip',
		async () => {
			const values: number[] = []
			for (let i = 0; i < (Number.isFinite(pineconeDim) && pineconeDim > 0 ? pineconeDim : 512); i += 1)
				values.push(0.1 + i * 0.01)
			await assertUpsertQueryDeleteRoundTrip(
				VectorStoreClient.fromAuth({
					provider: 'pinecone',
					api_key: pineconeKey!,
					base_url: pineconeBase!,
					...(pineconeNs ? { default_namespace: pineconeNs } : {})
				}),
				{ values, settleMs: 2500, ...(pineconeNs ? { namespace: pineconeNs } : {}) }
			)
		},
		{ timeout: 30_000 }
	)
})

runS('live seam vector-store supabase', () => {
	test('round-trip', async () => {
		await assertUpsertQueryDeleteRoundTrip(
			VectorStoreClient.fromAuth({
				provider: 'supabase',
				url: supabaseUrl!,
				api_key: supabaseKey!,
				default_collection: supabaseTable
			}),
			{ values: sampleVectorA }
		)
	})
})

runM('live seam vector-store mastra', () => {
	test('round-trip', async () => {
		assertLocalUrl(mastraDb!, 'AI_TOOLS_MASTRA_DB_URL')
		const indexName = uniqueId('seam_mastra').replaceAll('-', '_')
		await assertUpsertQueryDeleteRoundTrip(
			VectorStoreClient.fromAuth({
				provider: 'mastra',
				connection_string: mastraDb!,
				id: `ai-tools-seam-${indexName}`,
				default_index: indexName,
				dimension: sampleVectorA.length,
				auto_create_index: true,
				...(mastraSchema ? { schema_name: mastraSchema } : {})
			}),
			{ values: sampleVectorA }
		)
	})
})
