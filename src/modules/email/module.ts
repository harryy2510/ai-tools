import { defineModule, defineTool } from '../../core/define'
import {
	sendEmailBatchInputSchema,
	sendEmailBatchOutputSchema,
	sendEmailInputSchema,
	sendEmailOutputSchema
} from './contracts'
import { EmailClient, emailAuthSchema, emailProviders } from './client'

const sendEmailTool = defineTool({
	id: 'email-send',
	name: 'sendEmail',
	description:
		'Send one transactional email. Use for single messages with subject and html/text body. Supports optional cc, bcc, reply_to, headers, and base64 attachments. Total message size must stay under 5 MiB.',
	inputSchema: sendEmailInputSchema,
	outputSchema: sendEmailOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => EmailClient.fromContext(ctx).send(input)
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
	execute: async (input, ctx) => EmailClient.fromContext(ctx).sendBatch(input)
})

export const emailModule = defineModule({
	id: 'email',
	title: 'Email',
	description: 'Send transactional email through a bound provider (Cloudflare Email, Resend, or future providers).',
	runtime: 'both',
	auth: { type: 'custom', schema: emailAuthSchema },
	tools: [sendEmailTool, sendEmailBatchTool]
})

export { emailAuthSchema, emailProviders, sendEmailBatchTool, sendEmailTool }
