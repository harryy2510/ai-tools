/**
 * Resend provider for the email seam. Wraps `ResendClient`.
 */

import { runBatchItems } from '../../../shared/batch'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { ResendClient } from '../../../vendors/resend'
import type { EmailOps, EmailSendBatchInput, EmailSendInput, EmailSendOutput, ResendEmailAuth } from '../contracts'

export type ResendEmailProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ResendEmailProvider implements EmailOps {
	readonly #client: ResendClient

	constructor(auth: ResendEmailAuth, options: ResendEmailProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new ResendClient(vendorAuth, options)
	}

	async send(input: EmailSendInput): Promise<EmailSendOutput> {
		const result = await this.#client.send(input)
		return {
			success: result.success,
			...(result.id && { id: result.id })
		}
	}

	sendBatch(input: EmailSendBatchInput) {
		return runBatchItems(input.messages, (message) => this.send(message))
	}
}
