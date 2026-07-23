/**
 * Email seam client — picks a provider class from host auth, same methods everywhere.
 * Host: `withAuth(emailModule, { provider, … })` then tools use `fromContext`.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { emailAuthSchema } from './contracts'
import type {
	EmailAuth,
	EmailOps,
	EmailSendBatchInput,
	EmailSendBatchOutput,
	EmailSendInput,
	EmailSendOutput
} from './contracts'
import { CloudflareEmailProvider } from './providers/cloudflare'
import { ResendEmailProvider } from './providers/resend'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: EmailAuth, ctx: ToolContext): EmailOps {
	const options = transportOptions(ctx)
	if (auth.provider === 'resend') {
		return new ResendEmailProvider(auth, options)
	}
	return new CloudflareEmailProvider(auth, options)
}

export class EmailClient implements EmailOps {
	readonly #ops: EmailOps

	constructor(ops: EmailOps) {
		this.#ops = ops
	}

	/** Host-bound auth on `ctx` (`provider` + vendor credentials). */
	static fromContext(ctx: ToolContext): EmailClient {
		const auth = requireAuth(ctx, emailAuthSchema)
		return new EmailClient(providerFor(auth, ctx))
	}

	/** Construct from already-parsed seam auth (tests / host helpers). */
	static fromAuth(auth: EmailAuth, ctx: ToolContext = {}): EmailClient {
		return new EmailClient(providerFor(auth, ctx))
	}

	async send(input: EmailSendInput): Promise<EmailSendOutput> {
		return this.#ops.send(input)
	}

	async sendBatch(input: EmailSendBatchInput): Promise<EmailSendBatchOutput> {
		return this.#ops.sendBatch(input)
	}
}
