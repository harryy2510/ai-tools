import { defineModule, defineTool } from '../../core/define'
import { ImessageClient } from './client'
import {
	imessageAuthSchema,
	imessageEditTextInputSchema,
	imessageMessageOutputSchema,
	imessageOkOutputSchema,
	imessageReadInputSchema,
	imessageSendChatActionInputSchema,
	imessageSendTextInputSchema,
	imessageSetReactionInputSchema,
	imessageUnsendInputSchema
} from './contracts'

export const imessageSendTextTool = defineTool({
	id: 'imessage-send-text',
	name: 'imessageSendText',
	description:
		'Send a text message to an iMessage space via the bound proxy. chat_id is the Spectrum space id. Returns message_id when available.',
	inputSchema: imessageSendTextInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).sendText(input)
})

export const imessageEditTextTool = defineTool({
	id: 'imessage-edit-text',
	name: 'imessageEditText',
	description: 'Edit a previously sent iMessage text message via the bound proxy.',
	inputSchema: imessageEditTextInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).editText(input)
})

export const imessageSendChatActionTool = defineTool({
	id: 'imessage-send-chat-action',
	name: 'imessageSendChatAction',
	description: 'Show a typing indicator on an iMessage space via the bound proxy.',
	inputSchema: imessageSendChatActionInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).sendChatAction(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageSetReactionTool = defineTool({
	id: 'imessage-set-reaction',
	name: 'imessageSetReaction',
	description: 'React to an iMessage with an emoji or tapback via the bound proxy.',
	inputSchema: imessageSetReactionInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).setReaction(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageUnsendTool = defineTool({
	id: 'imessage-unsend',
	name: 'imessageUnsend',
	description: 'Unsend a previously sent iMessage via the bound proxy.',
	inputSchema: imessageUnsendInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).unsend(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageReadTool = defineTool({
	id: 'imessage-read',
	name: 'imessageRead',
	description: 'Mark an iMessage conversation read up to a message id via the bound proxy.',
	inputSchema: imessageReadInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).read(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageModule = defineModule({
	id: 'imessage',
	title: 'iMessage',
	description:
		'iMessage outbound via hosted photon-rest-proxy: send and edit text, typing, reactions, unsend, and read. Host binds proxy base URL and Spectrum project credentials. Inbound uses Photon native webhooks on the host.',
	runtime: 'both',
	auth: { type: 'custom', schema: imessageAuthSchema },
	tools: [
		imessageSendTextTool,
		imessageEditTextTool,
		imessageSendChatActionTool,
		imessageSetReactionTool,
		imessageUnsendTool,
		imessageReadTool
	]
})
