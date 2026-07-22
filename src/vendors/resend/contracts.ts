import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'
import type { NamedAddress } from '../_email'
import { attachmentSchema, MAX_BATCH_EMAILS, MAX_EMAIL_BYTES, namedAddressSchema } from '../_email'

export { MAX_BATCH_EMAILS, MAX_EMAIL_BYTES, namedAddressSchema, attachmentSchema }
export type { NamedAddress }

export const resendAuthSchema = z.object({
	api_key: z.string().min(1).describe('Resend API key')
})

export type ResendAuth = z.infer<typeof resendAuthSchema>

export const resendSendInputSchema = z
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

export const resendSendOutputSchema = z.object({
	success: z.boolean().describe('Whether Resend accepted the request'),
	id: z.string().optional().describe('Resend message id when available')
})

export const resendSendBatchInputSchema = z.object({
	messages: z.array(resendSendInputSchema).min(1).max(MAX_BATCH_EMAILS).describe('Messages to send (max 20)')
})

export const resendSendBatchOutputSchema = batchResultSchema(resendSendOutputSchema)

export type ResendSendInput = z.infer<typeof resendSendInputSchema>
export type ResendSendOutput = z.infer<typeof resendSendOutputSchema>
export type ResendSendBatchInput = z.infer<typeof resendSendBatchInputSchema>
export type ResendSendBatchOutput = z.infer<typeof resendSendBatchOutputSchema>
