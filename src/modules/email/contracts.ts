import { z } from 'zod'

import type { ToolContext } from '../../core/types'
import { batchResultSchema } from '../../shared/batch'

export const MAX_EMAIL_BYTES = 5 * 1024 * 1024
export const MAX_BATCH_EMAILS = 20

const emailAddressSchema = z.email().describe('Email address')

export const namedAddressSchema = z.union([
	emailAddressSchema,
	z.object({
		email: emailAddressSchema,
		name: z.string().max(200).optional().describe('Display name')
	})
])

export const attachmentSchema = z.object({
	content: z.string().min(1).describe('Base64-encoded file bytes (no data: URL prefix)'),
	filename: z.string().min(1).max(255).describe('Attachment file name'),
	type: z.string().min(1).describe('MIME type, for example application/pdf'),
	disposition: z.enum(['attachment', 'inline']).optional().describe('Content disposition. Defaults to attachment')
})

export const sendEmailInputSchema = z
	.object({
		to: z
			.union([namedAddressSchema, z.array(namedAddressSchema).min(1).max(50)])
			.describe('Primary recipient address or list (max 50 combined to/cc/bcc)'),
		from: namedAddressSchema.describe('Verified sender address on the sending domain'),
		subject: z.string().min(1).max(998).describe('Email subject line'),
		html: z.string().optional().describe('HTML body. Provide html and/or text'),
		text: z.string().optional().describe('Plain text body. Provide html and/or text'),
		cc: z
			.union([namedAddressSchema, z.array(namedAddressSchema).max(50)])
			.optional()
			.describe('CC recipients'),
		bcc: z
			.union([namedAddressSchema, z.array(namedAddressSchema).max(50)])
			.optional()
			.describe('BCC recipients'),
		reply_to: namedAddressSchema.optional().describe('Reply-To address'),
		headers: z.record(z.string(), z.string()).optional().describe('Custom headers as a string map'),
		attachments: z
			.array(attachmentSchema)
			.max(32)
			.optional()
			.describe('Up to 32 base64 attachments. Total message must stay under 5 MiB')
	})
	.refine((v) => Boolean(v.html?.trim() || v.text?.trim()), {
		message: 'Provide html and/or text body'
	})

export const sendEmailOutputSchema = z.object({
	success: z.boolean().describe('Whether the provider accepted the request'),
	id: z.string().optional().describe('Provider message id when available'),
	accepted: z.array(z.string()).optional().describe('Addresses accepted (delivered and/or queued)'),
	rejected: z.array(z.string()).optional().describe('Addresses permanently rejected when known')
})

export const sendEmailBatchInputSchema = z.object({
	messages: z.array(sendEmailInputSchema).min(1).max(MAX_BATCH_EMAILS).describe('Messages to send (max 20)')
})

export const sendEmailBatchOutputSchema = batchResultSchema(sendEmailOutputSchema)

export type SendEmailInput = z.infer<typeof sendEmailInputSchema>
export type SendEmailOutput = z.infer<typeof sendEmailOutputSchema>
export type SendEmailBatchInput = z.infer<typeof sendEmailBatchInputSchema>
export type SendEmailBatchOutput = z.infer<typeof sendEmailBatchOutputSchema>
export type NamedAddress = z.infer<typeof namedAddressSchema>

export type EmailOps = {
	send: (input: SendEmailInput, ctx: ToolContext) => Promise<SendEmailOutput>
	sendBatch?: (input: SendEmailBatchInput, ctx: ToolContext) => Promise<SendEmailBatchOutput>
}
