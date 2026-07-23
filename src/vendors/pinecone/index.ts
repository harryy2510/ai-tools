export { PineconeClient } from './client'
export type { PineconeClientOptions } from './client'
export {
	MAX_TOP_K,
	MAX_VECTOR_BATCH,
	MAX_VECTOR_DIMENSIONS,
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	pineconeAuthSchema,
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
	PineconeAuth,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch,
	VectorMetadata,
	VectorPoint
} from './contracts'
export { pineconeDeleteTool, pineconeModule, pineconeQueryTool, pineconeUpsertTool } from './module'
