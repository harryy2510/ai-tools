import { z } from 'zod'

export {
	MAX_TOP_K,
	MAX_VECTOR_BATCH,
	MAX_VECTOR_DIMENSIONS,
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorPointSchema
} from '../_vector'
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
} from '../_vector'

export const qdrantAuthSchema = z.object({
	base_url: z
		.string()
		.url()
		.describe('Qdrant HTTP origin, for example http://127.0.0.1:6333 or https://xxx.cloud.qdrant.io'),
	api_key: z.string().min(1).optional().describe('Optional Qdrant API key'),
	default_collection: z.string().min(1).optional().describe('Default collection name when tool input omits collection')
})

export type QdrantAuth = z.infer<typeof qdrantAuthSchema>
