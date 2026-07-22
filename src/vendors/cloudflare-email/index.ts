export { CloudflareEmailClient } from './client'
export type { CloudflareEmailClientOptions } from './client'
export {
	attachmentSchema,
	cloudflareEmailAuthSchema,
	cloudflareEmailSendBatchInputSchema,
	cloudflareEmailSendBatchOutputSchema,
	cloudflareEmailSendInputSchema,
	cloudflareEmailSendOutputSchema,
	MAX_BATCH_EMAILS,
	MAX_EMAIL_BYTES,
	namedAddressSchema
} from './contracts'
export type {
	CloudflareEmailAuth,
	CloudflareEmailSendBatchInput,
	CloudflareEmailSendBatchOutput,
	CloudflareEmailSendInput,
	CloudflareEmailSendOutput,
	NamedAddress
} from './contracts'
export { cloudflareEmailModule, cloudflareEmailSendBatchTool, cloudflareEmailSendTool } from './module'
