/**
 * Email seam client — picks resend / cloudflare from host auth.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { emailAuthSchema } from './contracts'
import type { EmailAuth, EmailOps, EmailSendBatchInput, EmailSendInput } from './contracts'
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
	switch (auth.provider) {
		case 'resend':
			return new ResendEmailProvider(auth, options)
		case 'cloudflare':
			return new CloudflareEmailProvider(auth, options)
	}
}

export class EmailClient implements EmailOps {
	readonly #ops: EmailOps

	constructor(ops: EmailOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): EmailClient {
		const auth = requireAuth(ctx, emailAuthSchema)
		return new EmailClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: EmailAuth, ctx: ToolContext = {}): EmailClient {
		return new EmailClient(providerFor(auth, ctx))
	}

	send(input: EmailSendInput) {
		return this.#ops.send(input)
	}

	sendBatch(input: EmailSendBatchInput) {
		return this.#ops.sendBatch(input)
	}
}
