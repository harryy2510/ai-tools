export { CloudflareEmailClient } from './client'
export type { CloudflareEmailClientOptions } from './client'
export { cloudflareEmailAuthSchema } from './contracts'
export type {
	CloudflareEmailAuth,
	CloudflareEmailSendBatchInput,
	CloudflareEmailSendBatchOutput,
	CloudflareEmailSendInput,
	CloudflareEmailSendOutput,
	NamedAddress
} from './contracts'
export { cloudflareEmailModule, cloudflareEmailSendBatchTool, cloudflareEmailSendTool } from './module'
