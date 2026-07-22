/**
 * Public email capability client.
 * Host DX: construct with auth, call send/sendBatch.
 * Tools use EmailClient.fromContext(ctx) only — no ofetch in tools.
 */

import { z } from 'zod'

import { ToolError } from '../../core/errors'
import { requireAuth, resolveProvider } from '../../core/provider'
import type { FetchLike, ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import type { EmailOps, SendEmailBatchInput, SendEmailBatchOutput, SendEmailInput, SendEmailOutput } from './contracts'
import { cloudflareEmailAuthSchema, cloudflareEmailProvider } from './providers/cloudflare'
import { resendEmailAuthSchema, resendEmailProvider } from './providers/resend'

export const emailProviders = [cloudflareEmailProvider, resendEmailProvider] as const

export const emailAuthSchema = z.discriminatedUnion('provider', [cloudflareEmailAuthSchema, resendEmailAuthSchema])

export type EmailAuth = z.infer<typeof emailAuthSchema>

export type EmailClientOptions = {
	fetch?: FetchLike
	signal?: AbortSignal
}

/**
 * Transactional email client. Auth is fixed at construction; provider selected via auth.provider.
 */
export class EmailClient {
	readonly #auth: EmailAuth
	readonly #ctx: ToolContext

	constructor(auth: EmailAuth, options: EmailClientOptions = {}) {
		const parsed = emailAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid email auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#ctx = {
			auth: this.#auth,
			...(options.fetch === undefined ? {} : { fetch: options.fetch }),
			...(options.signal === undefined ? {} : { signal: options.signal })
		}
	}

	/** Build from tool context (withAuth path). */
	static fromContext(ctx: ToolContext): EmailClient {
		const auth = requireAuth(ctx, emailAuthSchema)
		return new EmailClient(auth, {
			...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch }),
			...(ctx.signal === undefined ? {} : { signal: ctx.signal })
		})
	}

	get provider(): EmailAuth['provider'] {
		return this.#auth.provider
	}

	async send(input: SendEmailInput): Promise<SendEmailOutput> {
		return this.#ops().send(input, this.#ctx)
	}

	async sendBatch(input: SendEmailBatchInput): Promise<SendEmailBatchOutput> {
		const ops = this.#ops()
		if (ops.sendBatch !== undefined) {
			return ops.sendBatch(input, this.#ctx)
		}
		return runBatchItems(input.messages, async (message) => ops.send(message, this.#ctx))
	}

	#ops(): EmailOps {
		return resolveProvider(emailProviders, this.#auth).ops
	}
}
