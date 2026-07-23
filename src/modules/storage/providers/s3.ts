/**
 * S3 provider for the storage seam. Wraps `S3Client`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { S3Client } from '../../../vendors/s3'
import type {
	AbortMultipartUploadInput,
	CompleteMultipartUploadInput,
	CopyObjectInput,
	CreateMultipartUploadInput,
	DeleteObjectInput,
	GetObjectInput,
	HeadObjectInput,
	ListObjectsInput,
	PutObjectInput,
	S3StorageAuth,
	SignedUrlInput,
	StorageOps,
	UploadPartInput
} from '../contracts'

export type S3StorageProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class S3StorageProvider implements StorageOps {
	readonly #client: S3Client

	constructor(auth: S3StorageAuth, options: S3StorageProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new S3Client(vendorAuth, options)
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
	createSignedUrl(input: SignedUrlInput) {
		return this.#client.createSignedUrl(input)
	}
	createMultipartUpload(input: CreateMultipartUploadInput) {
		return this.#client.createMultipartUpload(input)
	}
	uploadPart(input: UploadPartInput) {
		return this.#client.uploadPart(input)
	}
	completeMultipartUpload(input: CompleteMultipartUploadInput) {
		return this.#client.completeMultipartUpload(input)
	}
	abortMultipartUpload(input: AbortMultipartUploadInput) {
		return this.#client.abortMultipartUpload(input)
	}
	getBytes(key: string) {
		return this.#client.getBytes(key)
	}
	putBytes(key: string, bytes: Uint8Array, contentType?: string) {
		return this.#client.putBytes(key, bytes, contentType)
	}
}
