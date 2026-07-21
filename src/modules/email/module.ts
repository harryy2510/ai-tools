import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { requireAuth, resolveProvider } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import {
	sendEmailBatchInputSchema,
	sendEmailBatchOutputSchema,
	sendEmailInputSchema,
	sendEmailOutputSchema
} from './contracts'
import type { EmailOps } from './contracts'
import { cloudflareEmailAuthSchema, cloudflareEmailProvider } from './providers/cloudflare'
import { resendEmailAuthSchema, resendEmailProvider } from './providers/resend'

export const emailProviders = [cloudflareEmailProvider, resendEmailProvider] as const

export const emailAuthSchema = z.discriminatedUnion('provider', [cloudflareEmailAuthSchema, resendEmailAuthSchema])

export type EmailAuth = z.infer<typeof emailAuthSchema>

function resolveOps(ctx: ToolContext): EmailOps {
	const auth = requireAuth(ctx, emailAuthSchema)
	return resolveProvider(emailProviders, auth).ops
}

const sendEmailTool = defineTool({
	id: 'email-send',
	name: 'sendEmail',
	description:
		'Send one transactional email. Use for single messages with subject and html/text body. Supports optional cc, bcc, reply_to, headers, and base64 attachments. Total message size must stay under 5 MiB.',
	inputSchema: sendEmailInputSchema,
	outputSchema: sendEmailOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).send(input, ctx)
})

const sendEmailBatchTool = defineTool({
	id: 'email-send-batch',
	name: 'sendEmailBatch',
	description:
		'Send up to 20 transactional emails. Returns per-message success or error without aborting the whole batch.',
	inputSchema: sendEmailBatchInputSchema,
	outputSchema: sendEmailBatchOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		if (ops.sendBatch !== undefined) {
			return ops.sendBatch(input, ctx)
		}
		return runBatchItems(input.messages, async (message) => ops.send(message, ctx))
	}
})

export const emailModule = defineModule({
	id: 'email',
	title: 'Email',
	description: 'Send transactional email through a bound provider (Cloudflare Email, Resend, or future providers).',
	runtime: 'both',
	auth: { type: 'custom', schema: emailAuthSchema },
	tools: [sendEmailTool, sendEmailBatchTool]
})

export { sendEmailBatchTool, sendEmailTool }
