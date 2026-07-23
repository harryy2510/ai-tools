/**
 * R2 REST provider for the storage seam. Wraps `R2Client`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { R2Client } from '../../../vendors/r2'
import type {
	CopyObjectInput,
	DeleteObjectInput,
	GetObjectInput,
	HeadObjectInput,
	ListObjectsInput,
	PutObjectInput,
	R2StorageAuth,
	StorageOps
} from '../contracts'

export type R2StorageProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class R2StorageProvider implements StorageOps {
	readonly #client: R2Client

	constructor(auth: R2StorageAuth, options: R2StorageProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new R2Client(vendorAuth, options)
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
