/**
 * Vector-store seam contracts — shared I/O from vendors/_vector + provider auth union.
 */

import { z } from 'zod'

import {
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorPointSchema
} from '../../vendors/_vector'
import type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput
} from '../../vendors/_vector'
import { mastraVectorAuthSchema } from '../../vendors/mastra-vector'
import { pineconeAuthSchema } from '../../vendors/pinecone'
import { qdrantAuthSchema } from '../../vendors/qdrant'
import { supabaseVectorAuthSchema } from '../../vendors/supabase-vector'

export { MAX_TOP_K, MAX_VECTOR_BATCH, MAX_VECTOR_DIMENSIONS } from '../../vendors/_vector'
export {
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorPointSchema
}

export type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch,
	VectorMetadata,
	VectorPoint
} from '../../vendors/_vector'

export const qdrantVectorAuthSchema = qdrantAuthSchema.extend({
	provider: z.literal('qdrant')
})

export const pineconeVectorAuthSchema = pineconeAuthSchema.extend({
	provider: z.literal('pinecone')
})

export const supabaseVectorSeamAuthSchema = supabaseVectorAuthSchema.extend({
	provider: z.literal('supabase')
})

export const mastraVectorSeamAuthSchema = mastraVectorAuthSchema.extend({
	provider: z.literal('mastra')
})

export const vectorStoreAuthSchema = z.discriminatedUnion('provider', [
	qdrantVectorAuthSchema,
	pineconeVectorAuthSchema,
	supabaseVectorSeamAuthSchema,
	mastraVectorSeamAuthSchema
])

export type QdrantVectorAuth = z.infer<typeof qdrantVectorAuthSchema>
export type PineconeVectorAuth = z.infer<typeof pineconeVectorAuthSchema>
export type SupabaseVectorSeamAuth = z.infer<typeof supabaseVectorSeamAuthSchema>
export type MastraVectorSeamAuth = z.infer<typeof mastraVectorSeamAuthSchema>
export type VectorStoreAuth = z.infer<typeof vectorStoreAuthSchema>

/** Shared seam surface — provider classes implement this. */
export type VectorStoreOps = {
	upsert: (input: UpsertVectorsInput) => Promise<UpsertVectorsOutput>
	query: (input: QueryVectorsInput) => Promise<QueryVectorsOutput>
	delete: (input: DeleteVectorsInput) => Promise<DeleteVectorsOutput>
}
