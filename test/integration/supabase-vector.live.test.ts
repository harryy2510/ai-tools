/**
 * Live Supabase PostgREST + pgvector (table + match RPC).
 *
 * Env:
 *   AI_TOOLS_SUPABASE_URL=https://xxxx.supabase.co   (or http://127.0.0.1:54321)
 *   AI_TOOLS_SUPABASE_API_KEY=service_role_or_key_with_grants
 *   AI_TOOLS_SUPABASE_TABLE=ai_tools_vectors          (table name)
 *   AI_TOOLS_SUPABASE_SCHEMA=public                   (optional)
 *   AI_TOOLS_SUPABASE_MATCH_RPC=match_vectors         (optional)
 *   AI_TOOLS_SUPABASE_DIMENSION=3                     (optional; for docs only)
 *
 * Host must create table + RPC first (see docs/integration-vector-rag.md).
 */

import { describe, test } from 'bun:test'

import { SupabaseVectorClient } from '../../src/vendors/supabase-vector'
import { VectorStoreClient } from '../../src/modules/vector-store'
import { assertUpsertQueryDeleteRoundTrip, env, sampleVectorA } from './helpers'

const url = env('AI_TOOLS_SUPABASE_URL')
const apiKey = env('AI_TOOLS_SUPABASE_API_KEY')
const table = env('AI_TOOLS_SUPABASE_TABLE') ?? 'ai_tools_vectors'
const schema = env('AI_TOOLS_SUPABASE_SCHEMA')
const matchRpc = env('AI_TOOLS_SUPABASE_MATCH_RPC')
const run = url && apiKey ? describe : describe.skip

run('integration supabase-vector', () => {
	const vendorAuth = {
		url: url!,
		api_key: apiKey!,
		default_collection: table,
		...(schema ? { schema } : {}),
		...(matchRpc ? { match_rpc: matchRpc } : {})
	}

	test('vendor client round-trip', async () => {
		const client = new SupabaseVectorClient(vendorAuth)
		await assertUpsertQueryDeleteRoundTrip(client, { values: sampleVectorA })
	})

	test('vector-store seam provider=supabase', async () => {
		const client = VectorStoreClient.fromAuth({
			provider: 'supabase',
			...vendorAuth
		})
		await assertUpsertQueryDeleteRoundTrip(client, { values: sampleVectorA })
	})
})
