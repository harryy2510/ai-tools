import { defineModule, defineTool } from '../../core/define'
import { ImessageClient } from './client'
import {
	imessageAuthSchema,
	imessageClearReactionInputSchema,
	imessageDownloadFileInputSchema,
	imessageDownloadFileOutputSchema,
	imessageEditTextInputSchema,
	imessageMessageOutputSchema,
	imessageOkOutputSchema,
	imessageReadInputSchema,
	imessageSendChatActionInputSchema,
	imessageSendMediaInputSchema,
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
	description:
		'React to an iMessage with an emoji or tapback via the bound proxy. Returns reaction message_id — store it to clear later.',
	inputSchema: imessageSetReactionInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).setReaction(input)
})

export const imessageClearReactionTool = defineTool({
	id: 'imessage-clear-reaction',
	name: 'imessageClearReaction',
	description:
		'Clear an iMessage reaction by unsending the reaction message. message_id must be the id returned by setReaction (not the target message).',
	inputSchema: imessageClearReactionInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).clearReaction(input)
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

export const imessageSendMediaTool = defineTool({
	id: 'imessage-send-media',
	name: 'imessageSendMedia',
	description: 'Send a photo or document attachment to an iMessage space via the bound proxy (Spectrum attachment).',
	inputSchema: imessageSendMediaInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).sendMedia(input)
})

export const imessageDownloadFileTool = defineTool({
	id: 'imessage-download-file',
	name: 'imessageDownloadFile',
	description:
		'Download attachment/voice bytes for a Spectrum message id in a space via the bound proxy. Requires chat_id (space id) and file_id.',
	inputSchema: imessageDownloadFileInputSchema,
	outputSchema: imessageDownloadFileOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).downloadFile(input)
})

export const imessageModule = defineModule({
	id: 'imessage',
	title: 'iMessage',
	description:
		'iMessage outbound via hosted photon-rest-proxy: send/edit text, media, typing, reactions, clear reaction, unsend, read, download. Host binds proxy base URL and Spectrum project credentials. Inbound uses Photon native webhooks on the host.',
	runtime: 'both',
	auth: { type: 'custom', schema: imessageAuthSchema },
	tools: [
		imessageSendTextTool,
		imessageEditTextTool,
		imessageSendChatActionTool,
		imessageSetReactionTool,
		imessageClearReactionTool,
		imessageUnsendTool,
		imessageReadTool,
		imessageSendMediaTool,
		imessageDownloadFileTool
	]
})
