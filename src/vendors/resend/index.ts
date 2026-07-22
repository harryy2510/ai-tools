export { ResendClient } from './client'
export type { ResendClientOptions } from './client'
export {
	attachmentSchema,
	MAX_BATCH_EMAILS,
	MAX_EMAIL_BYTES,
	namedAddressSchema,
	resendAuthSchema,
	resendSendBatchInputSchema,
	resendSendBatchOutputSchema,
	resendSendInputSchema,
	resendSendOutputSchema
} from './contracts'
export type {
	NamedAddress,
	ResendAuth,
	ResendSendBatchInput,
	ResendSendBatchOutput,
	ResendSendInput,
	ResendSendOutput
} from './contracts'
export { resendModule, resendSendBatchTool, resendSendTool } from './module'
