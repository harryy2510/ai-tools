/**
 * Vector-store seam client — picks qdrant / pinecone / supabase / mastra from host auth.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { vectorStoreAuthSchema } from './contracts'
import type {
	DeleteVectorsInput,
	QueryVectorsInput,
	UpsertVectorsInput,
	VectorStoreAuth,
	VectorStoreOps
} from './contracts'
import { MastraVectorStoreProvider } from './providers/mastra'
import { PineconeVectorStoreProvider } from './providers/pinecone'
import { QdrantVectorStoreProvider } from './providers/qdrant'
import { SupabaseVectorStoreProvider } from './providers/supabase'

function transportOptions(ctx: ToolContext): { fetch?: ToolContext['fetch']; signal?: ToolContext['signal'] } {
	const options: { fetch?: ToolContext['fetch']; signal?: ToolContext['signal'] } = {}
	if (ctx.fetch) options.fetch = ctx.fetch
	if (ctx.signal) options.signal = ctx.signal
	return options
}

function providerFor(auth: VectorStoreAuth, ctx: ToolContext): VectorStoreOps {
	const options = transportOptions(ctx)
	switch (auth.provider) {
		case 'qdrant':
			return new QdrantVectorStoreProvider(auth, options)
		case 'pinecone':
			return new PineconeVectorStoreProvider(auth, options)
		case 'supabase':
			return new SupabaseVectorStoreProvider(auth, options)
		case 'mastra':
			return new MastraVectorStoreProvider(auth)
	}
}

export class VectorStoreClient implements VectorStoreOps {
	readonly #ops: VectorStoreOps

	constructor(ops: VectorStoreOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): VectorStoreClient {
		const auth = requireAuth(ctx, vectorStoreAuthSchema)
		return new VectorStoreClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: VectorStoreAuth, ctx: ToolContext = {}): VectorStoreClient {
		return new VectorStoreClient(providerFor(auth, ctx))
	}

	upsert(input: UpsertVectorsInput) {
		return this.#ops.upsert(input)
	}

	query(input: QueryVectorsInput) {
		return this.#ops.query(input)
	}

	delete(input: DeleteVectorsInput) {
		return this.#ops.delete(input)
	}
}
