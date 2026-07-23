export { SupabaseVectorClient } from './client'
export type { SupabaseVectorClientOptions } from './client'
export {
	MAX_TOP_K,
	MAX_VECTOR_BATCH,
	MAX_VECTOR_DIMENSIONS,
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	supabaseVectorAuthSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorPointSchema
} from './contracts'
export type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	QueryVectorsInput,
	QueryVectorsOutput,
	SupabaseVectorAuth,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch,
	VectorMetadata,
	VectorPoint
} from './contracts'
export {
	supabaseVectorDeleteTool,
	supabaseVectorModule,
	supabaseVectorQueryTool,
	supabaseVectorUpsertTool
} from './module'
