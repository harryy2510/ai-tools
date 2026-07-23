/**
 * Transmute provider for the file-convert seam. Wraps `TransmuteClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { TransmuteClient } from '../../../vendors/transmute'
import type { ConvertBatchInput, ConvertInput, FileConvertOps, TransmuteFileConvertAuth } from '../contracts'

export type TransmuteFileConvertProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TransmuteFileConvertProvider implements FileConvertOps {
	readonly #client: TransmuteClient

	constructor(auth: TransmuteFileConvertAuth, options: TransmuteFileConvertProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new TransmuteClient(vendorAuth, options)
	}

	convert(input: ConvertInput) {
		return this.#client.convert(input)
	}

	convertBatch(input: ConvertBatchInput) {
		return this.#client.convertBatch(input)
	}
}
