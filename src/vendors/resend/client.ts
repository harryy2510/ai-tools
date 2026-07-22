/**
 * Resend vendor client.
 * Host: `new ResendClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	ResendAuth,
	ResendSendBatchInput,
	ResendSendBatchOutput,
	ResendSendInput,
	ResendSendOutput
} from './contracts'
import { resendAuthSchema } from './contracts'
import { parseSendResult, preflightSend } from './domain'

export type ResendClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ResendClient {
	readonly #http: HttpService

	constructor(auth: ResendAuth, options: ResendClientOptions = {}) {
		const parsed = resendAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Resend auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#http = new HttpService({
			...options,
			baseURL: 'https://api.resend.com',
			headers: {
				Authorization: `Bearer ${parsed.data.api_key}`,
				'Content-Type': 'application/json'
			},
			label: 'Resend'
		})
	}

	static fromContext(ctx: ToolContext): ResendClient {
		const auth = requireAuth(ctx, resendAuthSchema)
		return new ResendClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** POST /emails */
	async send(input: ResendSendInput): Promise<ResendSendOutput> {
		const payload = preflightSend(input)
		const { data } = await this.#http.post('/emails', payload, { label: 'Resend send' })
		return parseSendResult(data)
	}

	/** Sequential batch of independent sends (partial failure OK). */
	async sendBatch(input: ResendSendBatchInput): Promise<ResendSendBatchOutput> {
		return runBatchItems(input.messages, (message) => this.send(message))
	}
}
