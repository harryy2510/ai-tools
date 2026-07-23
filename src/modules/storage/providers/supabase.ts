/**
 * Supabase Storage provider for the storage seam. Wraps `SupabaseStorageClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { SupabaseStorageClient } from '../../../vendors/supabase-storage'
import type {
	CopyObjectInput,
	DeleteObjectInput,
	GetObjectInput,
	HeadObjectInput,
	ListObjectsInput,
	PutObjectInput,
	StorageOps,
	SupabaseStorageSeamAuth
} from '../contracts'

export type SupabaseStorageProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class SupabaseStorageProvider implements StorageOps {
	readonly #client: SupabaseStorageClient

	constructor(auth: SupabaseStorageSeamAuth, options: SupabaseStorageProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new SupabaseStorageClient(vendorAuth, options)
	}

	list(input: ListObjectsInput) {
		return this.#client.list(input)
	}
	get(input: GetObjectInput) {
		return this.#client.get(input)
	}
	put(input: PutObjectInput) {
		return this.#client.put(input)
	}
	delete(input: DeleteObjectInput) {
		return this.#client.delete(input)
	}
	head(input: HeadObjectInput) {
		return this.#client.head(input)
	}
	copy(input: CopyObjectInput) {
		return this.#client.copy(input)
	}
	getBytes(key: string) {
		return this.#client.getBytes(key)
	}
	putBytes(key: string, bytes: Uint8Array, contentType?: string) {
		return this.#client.putBytes(key, bytes, contentType)
	}
}
