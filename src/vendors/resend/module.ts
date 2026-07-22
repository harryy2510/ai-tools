import { defineModule, defineTool } from '../../core/define'
import {
	resendAuthSchema,
	resendSendBatchInputSchema,
	resendSendBatchOutputSchema,
	resendSendInputSchema,
	resendSendOutputSchema
} from './contracts'
import { ResendClient } from './client'

const sendTool = defineTool({
	id: 'resend-send',
	name: 'resendSend',
	description:
		'Send one email via Resend. Subject plus html and/or text. Optional cc, bcc, reply_to, headers, base64 attachments. Total under 5 MiB.',
	inputSchema: resendSendInputSchema,
	outputSchema: resendSendOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => ResendClient.fromContext(ctx).send(input)
})

const sendBatchTool = defineTool({
	id: 'resend-send-batch',
	name: 'resendSendBatch',
	description: 'Send up to 20 emails via Resend. Per-message success or error without aborting the batch.',
	inputSchema: resendSendBatchInputSchema,
	outputSchema: resendSendBatchOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => ResendClient.fromContext(ctx).sendBatch(input)
})

export const resendModule = defineModule({
	id: 'resend',
	title: 'Resend',
	description:
		'Resend vendor pack: send transactional email and expand to the rest of the Resend API over time. Use when the agent should call Resend directly, not a generic multi-provider email seam.',
	runtime: 'both',
	auth: { type: 'custom', schema: resendAuthSchema },
	tools: [sendTool, sendBatchTool]
})

export { sendBatchTool as resendSendBatchTool, sendTool as resendSendTool }
