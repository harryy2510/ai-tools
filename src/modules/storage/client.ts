/**
 * Storage seam client — picks s3 / r2 / supabase provider from host auth.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { storageAuthSchema } from './contracts'
import type {
	CopyObjectInput,
	DeleteObjectInput,
	GetObjectInput,
	HeadObjectInput,
	ListObjectsInput,
	PutObjectInput,
	StorageAuth,
	StorageOps
} from './contracts'
import { R2StorageProvider } from './providers/r2'
import { S3StorageProvider } from './providers/s3'
import { SupabaseStorageProvider } from './providers/supabase'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: StorageAuth, ctx: ToolContext): StorageOps {
	const options = transportOptions(ctx)
	switch (auth.provider) {
		case 's3':
			return new S3StorageProvider(auth, options)
		case 'r2':
			return new R2StorageProvider(auth, options)
		case 'supabase':
			return new SupabaseStorageProvider(auth, options)
	}
}

export class StorageClient implements StorageOps {
	readonly #ops: StorageOps

	constructor(ops: StorageOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): StorageClient {
		const auth = requireAuth(ctx, storageAuthSchema)
		return new StorageClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: StorageAuth, ctx: ToolContext = {}): StorageClient {
		return new StorageClient(providerFor(auth, ctx))
	}

	list(input: ListObjectsInput) {
		return this.#ops.list(input)
	}
	get(input: GetObjectInput) {
		return this.#ops.get(input)
	}
	put(input: PutObjectInput) {
		return this.#ops.put(input)
	}
	delete(input: DeleteObjectInput) {
		return this.#ops.delete(input)
	}
	head(input: HeadObjectInput) {
		return this.#ops.head(input)
	}
	copy(input: CopyObjectInput) {
		return this.#ops.copy(input)
	}
	getBytes(key: string) {
		return this.#ops.getBytes(key)
	}
	putBytes(key: string, bytes: Uint8Array, contentType?: string) {
		return this.#ops.putBytes(key, bytes, contentType)
	}

	/** Underlying ops (for optional-method checks in tools). */
	get ops(): StorageOps {
		return this.#ops
	}
}
