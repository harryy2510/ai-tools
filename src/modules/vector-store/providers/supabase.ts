/**
 * Supabase pgvector provider for the vector-store seam. Wraps `SupabaseVectorClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { SupabaseVectorClient } from '../../../vendors/supabase-vector'
import type {
	DeleteVectorsInput,
	QueryVectorsInput,
	SupabaseVectorSeamAuth,
	UpsertVectorsInput,
	VectorStoreOps
} from '../contracts'

export type SupabaseVectorProviderOptions = {
	fetch?: HttpServiceOptions['fetch'] | undefined
	signal?: HttpServiceOptions['signal'] | undefined
}

export class SupabaseVectorStoreProvider implements VectorStoreOps {
	readonly #client: SupabaseVectorClient

	constructor(auth: SupabaseVectorSeamAuth, options: SupabaseVectorProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new SupabaseVectorClient(vendorAuth, options)
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
