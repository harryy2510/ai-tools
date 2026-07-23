/**
 * Public email seam surface.
 * Internals (providers/*) stay private.
 */

export { EmailClient } from './client'
export { emailAuthSchema, emailModule, emailSendBatchTool, emailSendTool } from './module'
export type { EmailAuth } from './module'
export type {
	EmailSendBatchInput,
	EmailSendBatchOutput,
	EmailSendInput,
	EmailSendOutput,
	NamedAddress
} from './contracts'
export {
	attachmentSchema,
	emailSendBatchInputSchema,
	emailSendBatchOutputSchema,
	emailSendInputSchema,
	emailSendOutputSchema,
	MAX_BATCH_EMAILS,
	MAX_EMAIL_BYTES,
	namedAddressSchema
} from './contracts'
