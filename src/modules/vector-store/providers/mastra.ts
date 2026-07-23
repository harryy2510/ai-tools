/**
 * Mastra PgVector provider for the vector-store seam. Wraps `MastraVectorClient`.
 */

import { MastraVectorClient } from '../../../vendors/mastra-vector'
import type { MastraVectorClientOptions } from '../../../vendors/mastra-vector'
import type {
	DeleteVectorsInput,
	MastraVectorSeamAuth,
	QueryVectorsInput,
	UpsertVectorsInput,
	VectorStoreOps
} from '../contracts'

export type MastraVectorProviderOptions = MastraVectorClientOptions

export class MastraVectorStoreProvider implements VectorStoreOps {
	readonly #client: MastraVectorClient

	constructor(auth: MastraVectorSeamAuth, options: MastraVectorProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new MastraVectorClient(vendorAuth, options)
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
