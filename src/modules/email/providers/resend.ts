/**
 * Resend provider for the email seam.
 * Wraps `ResendClient` — no ESP HTTP of its own.
 */

import { runBatchItems } from '../../../shared/batch'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { ResendClient } from '../../../vendors/resend'
import type {
	EmailOps,
	EmailSendBatchInput,
	EmailSendBatchOutput,
	EmailSendInput,
	EmailSendOutput,
	ResendEmailAuth
} from '../contracts'

export type ResendEmailProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ResendEmailProvider implements EmailOps {
	readonly #client: ResendClient

	constructor(auth: ResendEmailAuth, options: ResendEmailProviderOptions = {}) {
		this.#client = new ResendClient({ api_key: auth.api_key }, options)
	}

	async send(input: EmailSendInput): Promise<EmailSendOutput> {
		const result = await this.#client.send(input)
		return {
			success: result.success,
			...(result.id && { id: result.id })
		}
	}

	async sendBatch(input: EmailSendBatchInput): Promise<EmailSendBatchOutput> {
		return runBatchItems(input.messages, (message) => this.send(message))
	}
}
