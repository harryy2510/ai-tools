/**
 * RAG client — host-bound OpenAI-compatible embeddings + nested vector-store.
 */

import { isPlainObject } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { VectorStoreClient } from '../vector-store'
import type { VectorStoreAuth } from '../vector-store'
import { MAX_EMBED_BATCH, ragAuthSchema } from './contracts'
import type {
	EmbedAuth,
	RagAuth,
	RagDeleteInput,
	RagDeleteOutput,
	RagIngestInput,
	RagIngestOutput,
	RagRetrieveInput,
	RagRetrieveOutput
} from './contracts'
import { chunkId, chunkText } from './domain'

export type RagClientOptions = {
	fetch?: HttpServiceOptions['fetch'] | undefined
	signal?: HttpServiceOptions['signal'] | undefined
}

export class RagClient {
	readonly #vectors: VectorStoreClient
	readonly #embedHttp: HttpService
	readonly #embed: EmbedAuth
	readonly #defaultCollection: string | undefined
	readonly #defaultChunk: RagAuth['chunk']

	constructor(auth: RagAuth, options: RagClientOptions = {}) {
		const vectorCtx: ToolContext = {}
		if (options.fetch) vectorCtx.fetch = options.fetch
		if (options.signal) vectorCtx.signal = options.signal
		this.#vectors = VectorStoreClient.fromAuth(auth.vector_store, vectorCtx)
		this.#embed = auth.embed
		this.#defaultCollection = auth.default_collection
		this.#defaultChunk = auth.chunk

		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		}
		if (auth.embed.api_key) {
			headers['Authorization'] = `Bearer ${auth.embed.api_key}`
		}
		const httpOptions: HttpServiceOptions = {
			baseURL: auth.embed.base_url,
			headers,
			label: 'RAG embed'
		}
		if (options.fetch) httpOptions.fetch = options.fetch
		if (options.signal) httpOptions.signal = options.signal
		this.#embedHttp = new HttpService(httpOptions)
	}

	static fromContext(ctx: ToolContext): RagClient {
		const auth = requireAuth(ctx, ragAuthSchema)
		const options: RagClientOptions = {}
		if (ctx.fetch) options.fetch = ctx.fetch
		if (ctx.signal) options.signal = ctx.signal
		return new RagClient(auth, options)
	}

	static fromAuth(auth: RagAuth, options: RagClientOptions = {}): RagClient {
		return new RagClient(auth, options)
	}

	async ingest(input: RagIngestInput): Promise<RagIngestOutput> {
		const chunkOpts: { max_chars?: number; overlap?: number } = {}
		const maxChars = input.chunk?.max_chars ?? this.#defaultChunk?.max_chars
		const overlap = input.chunk?.overlap ?? this.#defaultChunk?.overlap
		if (maxChars !== undefined) chunkOpts.max_chars = maxChars
		if (overlap !== undefined) chunkOpts.overlap = overlap
		const chunks = chunkText(input.text, chunkOpts)
		if (chunks.length === 0) {
			throw new ToolError('RAG ingest produced no chunks', { code: 'bad_input' })
		}

		const embeddings = await this.#embedTexts(chunks)
		if (embeddings.length !== chunks.length) {
			throw new ToolError('Embed route returned a different number of vectors than chunks', {
				code: 'upstream'
			})
		}

		const chunkIds = chunks.map((_, index) => chunkId(input.document_id, index))
		const vectors = chunks.map((text, index) => {
			const values = embeddings[index]
			if (!values) {
				throw new ToolError('Missing embedding for chunk', { code: 'upstream', details: { index } })
			}
			const metadata: Record<string, string | number | boolean | null> = {
				document_id: input.document_id,
				chunk_index: index,
				text
			}
			if (input.metadata) {
				for (const [key, value] of Object.entries(input.metadata)) {
					if (key === 'document_id' || key === 'chunk_index' || key === 'text') continue
					metadata[key] = value
				}
			}
			return {
				id: chunkIds[index] ?? chunkId(input.document_id, index),
				values,
				metadata
			}
		})

		const collection = input.collection ?? this.#defaultCollection
		const upsertInput: Parameters<VectorStoreClient['upsert']>[0] = { vectors }
		if (collection) upsertInput.collection = collection
		if (input.namespace) upsertInput.namespace = input.namespace
		const result = await this.#vectors.upsert(upsertInput)

		const out: RagIngestOutput = {
			document_id: input.document_id,
			chunk_count: chunks.length,
			chunk_ids: chunkIds
		}
		const resolvedCollection = result.collection ?? collection
		if (resolvedCollection) out.collection = resolvedCollection
		return out
	}

	async retrieve(input: RagRetrieveInput): Promise<RagRetrieveOutput> {
		const [queryVector] = await this.#embedTexts([input.query])
		if (!queryVector) {
			throw new ToolError('Embed route returned no vector for the query', { code: 'upstream' })
		}

		const collection = input.collection ?? this.#defaultCollection
		const queryInput: Parameters<VectorStoreClient['query']>[0] = {
			vector: queryVector,
			top_k: input.top_k ?? 8,
			include_metadata: true
		}
		if (collection) queryInput.collection = collection
		if (input.namespace) queryInput.namespace = input.namespace
		if (input.filter) queryInput.filter = input.filter
		const result = await this.#vectors.query(queryInput)

		const matches = result.matches.map((match) => {
			const meta = match.metadata
			const text =
				meta && typeof meta['text'] === 'string'
					? meta['text']
					: meta && typeof meta['content'] === 'string'
						? meta['content']
						: undefined
			const documentId = meta && typeof meta['document_id'] === 'string' ? meta['document_id'] : undefined
			const chunkIndex = meta && typeof meta['chunk_index'] === 'number' ? meta['chunk_index'] : undefined
			const row: RagRetrieveOutput['matches'][number] = {
				id: match.id,
				score: match.score
			}
			if (text !== undefined) row.text = text
			if (documentId !== undefined) row.document_id = documentId
			if (chunkIndex !== undefined) row.chunk_index = chunkIndex
			if (meta !== undefined) row.metadata = meta
			return row
		})

		const out: RagRetrieveOutput = { matches }
		const resolvedCollection = result.collection ?? collection
		if (resolvedCollection) out.collection = resolvedCollection
		return out
	}

	async delete(input: RagDeleteInput): Promise<RagDeleteOutput> {
		const collection = input.collection ?? this.#defaultCollection
		const deleteInput: Parameters<VectorStoreClient['delete']>[0] = { ids: input.chunk_ids }
		if (collection) deleteInput.collection = collection
		if (input.namespace) deleteInput.namespace = input.namespace
		const result = await this.#vectors.delete(deleteInput)
		const out: RagDeleteOutput = { deleted: result.deleted }
		const resolvedCollection = result.collection ?? collection
		if (resolvedCollection) out.collection = resolvedCollection
		return out
	}

	async #embedTexts(texts: string[]): Promise<number[][]> {
		const path = this.#embed.path ?? '/embeddings'
		const out: number[][] = []

		for (let offset = 0; offset < texts.length; offset += MAX_EMBED_BATCH) {
			const batch = texts.slice(offset, offset + MAX_EMBED_BATCH)
			const body: Record<string, unknown> = {
				model: this.#embed.model,
				input: batch
			}
			if (this.#embed.dimensions !== undefined) {
				body['dimensions'] = this.#embed.dimensions
			}

			const res = await this.#embedHttp.post(path, body, {
				label: 'RAG embeddings',
				noThrow: true
			})
			if (!res.ok) {
				throw new ToolError(embedErrorMessage(res.data, res.status), {
					code: mapEmbedStatus(res.status),
					details: { status: res.status }
				})
			}

			const data = isPlainObject(res.data) ? res.data['data'] : undefined
			if (!Array.isArray(data)) {
				throw new ToolError('Embed route returned an invalid data array', { code: 'upstream' })
			}

			const byIndex = new Map<number, number[]>()
			for (const row of data) {
				if (!isPlainObject(row)) continue
				const index = typeof row['index'] === 'number' ? row['index'] : byIndex.size
				const embedding = row['embedding']
				if (!Array.isArray(embedding)) continue
				const values: number[] = []
				for (const n of embedding) {
					if (typeof n !== 'number' || !Number.isFinite(n)) {
						throw new ToolError('Embed route returned a non-numeric embedding', { code: 'upstream' })
					}
					values.push(n)
				}
				byIndex.set(index, values)
			}

			for (let i = 0; i < batch.length; i += 1) {
				const values = byIndex.get(i)
				if (!values) {
					throw new ToolError('Embed route missing embedding for batch item', {
						code: 'upstream',
						details: { index: offset + i }
					})
				}
				out.push(values)
			}
		}

		return out
	}
}

function embedErrorMessage(data: unknown, status: number): string {
	if (isPlainObject(data)) {
		const err = data['error']
		if (typeof err === 'string' && err.length > 0) return err
		if (isPlainObject(err) && typeof err['message'] === 'string') return err['message']
		if (typeof data['message'] === 'string' && data['message'].length > 0) return data['message']
	}
	return `RAG embeddings failed with HTTP ${status}`
}

function mapEmbedStatus(status: number): ToolError['code'] {
	if (status === 401 || status === 403) return 'bad_auth'
	if (status === 404) return 'not_found'
	if (status === 400 || status === 422) return 'bad_input'
	if (status === 429) return 'rate_limited'
	return 'upstream'
}

/** Re-export nested auth type for hosts. */
export type { VectorStoreAuth }
