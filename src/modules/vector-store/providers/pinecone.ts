/**
 * Pinecone provider for the vector-store seam. Wraps `PineconeClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { PineconeClient } from '../../../vendors/pinecone'
import type {
	DeleteVectorsInput,
	PineconeVectorAuth,
	QueryVectorsInput,
	UpsertVectorsInput,
	VectorStoreOps
} from '../contracts'

export type PineconeVectorProviderOptions = {
	fetch?: HttpServiceOptions['fetch'] | undefined
	signal?: HttpServiceOptions['signal'] | undefined
}

export class PineconeVectorStoreProvider implements VectorStoreOps {
	readonly #client: PineconeClient

	constructor(auth: PineconeVectorAuth, options: PineconeVectorProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new PineconeClient(vendorAuth, options)
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
