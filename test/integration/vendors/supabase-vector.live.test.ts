import { describe, test } from 'bun:test'

import { VectorStoreClient } from '../../../src/modules/vector-store'
import { SupabaseVectorClient } from '../../../src/vendors/supabase-vector'
import { assertUpsertQueryDeleteRoundTrip, env, sampleVectorA } from '../helpers'

const url = env('AI_TOOLS_SUPABASE_URL')
const apiKey = env('AI_TOOLS_SUPABASE_API_KEY')
const table = env('AI_TOOLS_SUPABASE_VECTOR_TABLE') ?? env('AI_TOOLS_SUPABASE_TABLE') ?? 'ai_tools_vectors'
const schema = env('AI_TOOLS_SUPABASE_SCHEMA')
const matchRpc = env('AI_TOOLS_SUPABASE_MATCH_RPC')
const run = url && apiKey ? describe : describe.skip

run('live vendor supabase-vector', () => {
	const vendorAuth = {
		url: url!,
		api_key: apiKey!,
		default_collection: table,
		...(schema ? { schema } : {}),
		...(matchRpc ? { match_rpc: matchRpc } : {})
	}

	test('client round-trip', async () => {
		await assertUpsertQueryDeleteRoundTrip(new SupabaseVectorClient(vendorAuth), {
			values: sampleVectorA
		})
	})

	test('seam vector-store provider=supabase', async () => {
		await assertUpsertQueryDeleteRoundTrip(VectorStoreClient.fromAuth({ provider: 'supabase', ...vendorAuth }), {
			values: sampleVectorA
		})
	})
})
