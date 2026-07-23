/**
 * Cloudflare Email provider for the email seam. Wraps `CloudflareEmailClient`.
 */

import { runBatchItems } from '../../../shared/batch'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { CloudflareEmailClient } from '../../../vendors/cloudflare-email'
import type {
	CloudflareEmailSeamAuth,
	EmailOps,
	EmailSendBatchInput,
	EmailSendInput,
	EmailSendOutput
} from '../contracts'

export type CloudflareEmailProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareEmailProvider implements EmailOps {
	readonly #client: CloudflareEmailClient

	constructor(auth: CloudflareEmailSeamAuth, options: CloudflareEmailProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new CloudflareEmailClient(vendorAuth, options)
	}

	async send(input: EmailSendInput): Promise<EmailSendOutput> {
		const result = await this.#client.send(input)
		return {
			success: result.success,
			...(result.accepted && result.accepted.length > 0 && { accepted: result.accepted }),
			...(result.rejected && result.rejected.length > 0 && { rejected: result.rejected })
		}
	}

	sendBatch(input: EmailSendBatchInput) {
		return runBatchItems(input.messages, (message) => this.send(message))
	}
}
