import { defineModule, defineTool } from '../../core/define'
import { MessagingClient } from './client'
import {
	messagingAnswerCallbackInputSchema,
	messagingAuthSchema,
	messagingClearReactionInputSchema,
	messagingDownloadFileInputSchema,
	messagingDownloadFileOutputSchema,
	messagingEditTextInputSchema,
	messagingMessageOutputSchema,
	messagingOkOutputSchema,
	messagingSendChatActionInputSchema,
	messagingSendMediaInputSchema,
	messagingSendTextInputSchema,
	messagingSetReactionInputSchema
} from './contracts'

export type { MessagingAuth } from './contracts'
export { messagingAuthSchema }

export const messagingSendTextTool = defineTool({
	id: 'messaging-send-text',
	name: 'messagingSendText',
	description:
		'Send a text message on the bound messaging channel. Optional reply_to_message_id anchors a reply or thread. Returns message_id.',
	inputSchema: messagingSendTextInputSchema,
	outputSchema: messagingMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).sendText(input)
})

export const messagingEditTextTool = defineTool({
	id: 'messaging-edit-text',
	name: 'messagingEditText',
	description: 'Edit the text of an existing message on the bound messaging channel.',
	inputSchema: messagingEditTextInputSchema,
	outputSchema: messagingMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).editText(input)
})

export const messagingSendChatActionTool = defineTool({
	id: 'messaging-send-chat-action',
	name: 'messagingSendChatAction',
	description:
		'Show a chat action (typing, upload, …) on the bound channel when supported. Some channels treat this as presentation-only.',
	inputSchema: messagingSendChatActionInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).sendChatAction(input)
		return { ok: true }
	}
})

export const messagingSetReactionTool = defineTool({
	id: 'messaging-set-reaction',
	name: 'messagingSetReaction',
	description: 'Set an emoji reaction on a message when the bound channel supports reactions.',
	inputSchema: messagingSetReactionInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).setReaction(input)
		return { ok: true }
	}
})

export const messagingClearReactionTool = defineTool({
	id: 'messaging-clear-reaction',
	name: 'messagingClearReaction',
	description: 'Clear bot reactions on a message. Some channels require emoji to name which reaction to remove.',
	inputSchema: messagingClearReactionInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).clearReaction(input)
		return { ok: true }
	}
})

export const messagingSendMediaTool = defineTool({
	id: 'messaging-send-media',
	name: 'messagingSendMedia',
	description: 'Send one photo or document on the bound messaging channel from a base64 body.',
	inputSchema: messagingSendMediaInputSchema,
	outputSchema: messagingMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).sendMedia(input)
})

export const messagingDownloadFileTool = defineTool({
	id: 'messaging-download-file',
	name: 'messagingDownloadFile',
	description: 'Download a file by provider file id or content URL and return the body as base64.',
	inputSchema: messagingDownloadFileInputSchema,
	outputSchema: messagingDownloadFileOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).downloadFile(input)
})

export const messagingAnswerCallbackTool = defineTool({
	id: 'messaging-answer-callback',
	name: 'messagingAnswerCallback',
	description:
		'Acknowledge an inbound interactive callback when the bound channel supports it (toast, alert, or response URL).',
	inputSchema: messagingAnswerCallbackInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).answerCallback(input)
		return { ok: true }
	}
})

export const messagingModule = defineModule({
	id: 'messaging',
	title: 'Messaging',
	description:
		'Multi-channel messaging seam: send and edit text, media, chat actions, reactions, file download, and callback answers via the host-bound channel provider (telegram, slack, or teams).',
	runtime: 'both',
	auth: { type: 'custom', schema: messagingAuthSchema },
	tools: [
		messagingSendTextTool,
		messagingEditTextTool,
		messagingSendChatActionTool,
		messagingSetReactionTool,
		messagingClearReactionTool,
		messagingSendMediaTool,
		messagingDownloadFileTool,
		messagingAnswerCallbackTool
	]
})
