/**
 * Public vector-store seam surface.
 * Internals (providers/*) stay private; HTTP lives in vendors/qdrant|pinecone|supabase-vector.
 */

export { VectorStoreClient } from './client'
export {
	MAX_TOP_K,
	MAX_VECTOR_BATCH,
	MAX_VECTOR_DIMENSIONS,
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	mastraVectorSeamAuthSchema,
	pineconeVectorAuthSchema,
	qdrantVectorAuthSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	supabaseVectorSeamAuthSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorPointSchema,
	vectorStoreAuthSchema
} from './contracts'
export type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	MastraVectorSeamAuth,
	PineconeVectorAuth,
	QdrantVectorAuth,
	QueryVectorsInput,
	QueryVectorsOutput,
	SupabaseVectorSeamAuth,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch,
	VectorMetadata,
	VectorPoint,
	VectorStoreAuth,
	VectorStoreOps
} from './contracts'
export { vectorStoreDeleteTool, vectorStoreModule, vectorStoreQueryTool, vectorStoreUpsertTool } from './module'
