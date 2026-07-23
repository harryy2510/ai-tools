export { MastraVectorClient } from './client'
export type { MastraVectorClientOptions } from './client'
export {
	MAX_TOP_K,
	MAX_VECTOR_BATCH,
	MAX_VECTOR_DIMENSIONS,
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	mastraVectorAuthSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorPointSchema
} from './contracts'
export type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	MastraVectorAuth,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch,
	VectorMetadata,
	VectorPoint
} from './contracts'
export { mastraVectorDeleteTool, mastraVectorModule, mastraVectorQueryTool, mastraVectorUpsertTool } from './module'
