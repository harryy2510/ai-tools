/**
 * Qdrant provider for the vector-store seam. Wraps `QdrantClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { QdrantClient } from '../../../vendors/qdrant'
import type {
	DeleteVectorsInput,
	QdrantVectorAuth,
	QueryVectorsInput,
	UpsertVectorsInput,
	VectorStoreOps
} from '../contracts'

export type QdrantVectorProviderOptions = {
	fetch?: HttpServiceOptions['fetch'] | undefined
	signal?: HttpServiceOptions['signal'] | undefined
}

export class QdrantVectorStoreProvider implements VectorStoreOps {
	readonly #client: QdrantClient

	constructor(auth: QdrantVectorAuth, options: QdrantVectorProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new QdrantClient(vendorAuth, options)
	}

	upsert(input: UpsertVectorsInput) {
		return this.#client.upsert(input)
	}
	query(input: QueryVectorsInput) {
		return this.#client.query(input)
	}
	delete(input: DeleteVectorsInput) {
		return this.#client.delete(input)
	}
}
