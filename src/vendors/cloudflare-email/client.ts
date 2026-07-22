/**
 * Cloudflare Email Sending vendor client.
 * Host: `new CloudflareEmailClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	CloudflareEmailAuth,
	CloudflareEmailSendBatchInput,
	CloudflareEmailSendBatchOutput,
	CloudflareEmailSendInput,
	CloudflareEmailSendOutput
} from './contracts'
import { cloudflareEmailAuthSchema } from './contracts'
import { parseSendResult, preflightSend } from './domain'

export type CloudflareEmailClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareEmailClient {
	readonly #auth: CloudflareEmailAuth
	readonly #http: HttpService

	constructor(auth: CloudflareEmailAuth, options: CloudflareEmailClientOptions = {}) {
		const parsed = cloudflareEmailAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Cloudflare Email auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#http = new HttpService({
			...options,
			baseURL: 'https://api.cloudflare.com/client/v4',
			headers: {
				Authorization: `Bearer ${this.#auth.api_token}`,
				'Content-Type': 'application/json'
			},
			label: 'Cloudflare Email'
		})
	}

	static fromContext(ctx: ToolContext): CloudflareEmailClient {
		const auth = requireAuth(ctx, cloudflareEmailAuthSchema)
		return new CloudflareEmailClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** POST /accounts/{account_id}/email/sending/send */
	async send(input: CloudflareEmailSendInput): Promise<CloudflareEmailSendOutput> {
		const payload = preflightSend(input)
		const path = `/accounts/${encodeURIComponent(this.#auth.account_id)}/email/sending/send`
		const { data } = await this.#http.post(path, payload, { label: 'Cloudflare Email send' })
		return parseSendResult(data)
	}

	/** Sequential batch of independent sends (partial failure OK). */
	async sendBatch(input: CloudflareEmailSendBatchInput): Promise<CloudflareEmailSendBatchOutput> {
		return runBatchItems(input.messages, (message) => this.send(message))
	}
}
