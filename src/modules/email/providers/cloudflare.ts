/**
 * Cloudflare Email provider for the email seam.
 * Wraps `CloudflareEmailClient` — no ESP HTTP of its own.
 */

import { runBatchItems } from '../../../shared/batch'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { CloudflareEmailClient } from '../../../vendors/cloudflare-email'
import type {
	CloudflareEmailAuth,
	EmailOps,
	EmailSendBatchInput,
	EmailSendBatchOutput,
	EmailSendInput,
	EmailSendOutput
} from '../contracts'

export type CloudflareEmailProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareEmailProvider implements EmailOps {
	readonly #client: CloudflareEmailClient

	constructor(auth: CloudflareEmailAuth, options: CloudflareEmailProviderOptions = {}) {
		this.#client = new CloudflareEmailClient({ account_id: auth.account_id, api_token: auth.api_token }, options)
	}

	async send(input: EmailSendInput): Promise<EmailSendOutput> {
		const result = await this.#client.send(input)
		return {
			success: result.success,
			...(result.accepted && result.accepted.length > 0 && { accepted: result.accepted }),
			...(result.rejected && result.rejected.length > 0 && { rejected: result.rejected })
		}
	}

	async sendBatch(input: EmailSendBatchInput): Promise<EmailSendBatchOutput> {
		return runBatchItems(input.messages, (message) => this.send(message))
	}
}
