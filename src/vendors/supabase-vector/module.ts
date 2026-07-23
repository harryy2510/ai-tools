import { defineModule, defineTool } from '../../core/define'
import { SupabaseVectorClient } from './client'
import {
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	supabaseVectorAuthSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema
} from './contracts'

export const supabaseVectorUpsertTool = defineTool({
	id: 'supabase-vector-upsert',
	name: 'supabaseVectorUpsert',
	description: 'Upsert embedding rows into a Supabase PostgREST table (pgvector). Host must grant table write access.',
	inputSchema: upsertVectorsInputSchema,
	outputSchema: upsertVectorsOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseVectorClient.fromContext(ctx).upsert(input)
})

export const supabaseVectorQueryTool = defineTool({
	id: 'supabase-vector-query',
	name: 'supabaseVectorQuery',
	description: 'Nearest-neighbor query via host-owned match RPC (default match_vectors) over Supabase PostgREST.',
	inputSchema: queryVectorsInputSchema,
	outputSchema: queryVectorsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseVectorClient.fromContext(ctx).query(input)
})

export const supabaseVectorDeleteTool = defineTool({
	id: 'supabase-vector-delete',
	name: 'supabaseVectorDelete',
	description: 'Delete embedding rows by id from a Supabase PostgREST table.',
	inputSchema: deleteVectorsInputSchema,
	outputSchema: deleteVectorsOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseVectorClient.fromContext(ctx).delete(input)
})

export const supabaseVectorModule = defineModule({
	id: 'supabase-vector',
	title: 'Supabase Vector',
	description:
		'Supabase Postgres + pgvector via PostgREST: upsert, match RPC query, delete. Host owns table schema and match_vectors RPC.',
	runtime: 'both',
	auth: { type: 'custom', schema: supabaseVectorAuthSchema },
	tools: [supabaseVectorUpsertTool, supabaseVectorQueryTool, supabaseVectorDeleteTool]
})
