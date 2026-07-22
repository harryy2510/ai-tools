import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import {
	telegramAnswerCallbackInputSchema,
	telegramAuthSchema,
	telegramClearReactionInputSchema,
	telegramDownloadFileInputSchema,
	telegramDownloadFileOutputSchema,
	telegramEditTextInputSchema,
	telegramGetBotOutputSchema,
	telegramMessageOutputSchema,
	telegramOkOutputSchema,
	telegramSendChatActionInputSchema,
	telegramSendMediaGroupInputSchema,
	telegramSendMediaGroupOutputSchema,
	telegramSendMediaInputSchema,
	telegramSendTextInputSchema,
	telegramSetReactionInputSchema
} from './contracts'
import type { TelegramAuth } from './contracts'
import { createTelegramClientFromAuth, encodeDownloadForTool } from './client'

function readAuth(ctx: ToolContext): TelegramAuth {
	return requireAuth(ctx, telegramAuthSchema)
}

function client(ctx: ToolContext) {
	return createTelegramClientFromAuth(readAuth(ctx), ctx)
}

const emptyInputSchema = z.object({}).describe('No input fields')

const sendTextTool = defineTool({
	id: 'telegram-send-text',
	name: 'sendTelegramText',
	description:
		'Send a text message to a Telegram chat. Optional reply_to_message_id anchors a native reply. Returns the new message_id.',
	inputSchema: telegramSendTextInputSchema,
	outputSchema: telegramMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) =>
		client(ctx).sendText({
			chat_id: input.chat_id,
			text: input.text,
			...(input.reply_to_message_id === undefined ? {} : { reply_to_message_id: input.reply_to_message_id }),
			...(input.reply_markup === undefined ? {} : { reply_markup: input.reply_markup })
		})
})

const editTextTool = defineTool({
	id: 'telegram-edit-text',
	name: 'editTelegramText',
	description: 'Edit the text of an existing Telegram message. Used for progressive live updates and corrections.',
	inputSchema: telegramEditTextInputSchema,
	outputSchema: telegramMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) =>
		client(ctx).editText({
			chat_id: input.chat_id,
			message_id: input.message_id,
			text: input.text,
			...(input.reply_markup === undefined ? {} : { reply_markup: input.reply_markup })
		})
})

const sendChatActionTool = defineTool({
	id: 'telegram-send-chat-action',
	name: 'sendTelegramChatAction',
	description:
		'Show a chat action to the user (typing, upload_photo, upload_document, and other Telegram actions). Renew while work is in progress.',
	inputSchema: telegramSendChatActionInputSchema,
	outputSchema: telegramOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await client(ctx).sendChatAction(input)
		return { ok: true }
	}
})

const setReactionTool = defineTool({
	id: 'telegram-set-reaction',
	name: 'setTelegramReaction',
	description:
		'Set an emoji reaction on a Telegram message. Any emoji Telegram accepts for the bot and chat is allowed.',
	inputSchema: telegramSetReactionInputSchema,
	outputSchema: telegramOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await client(ctx).setReaction(input)
		return { ok: true }
	}
})

const clearReactionTool = defineTool({
	id: 'telegram-clear-reaction',
	name: 'clearTelegramReaction',
	description: 'Clear all bot reactions on a Telegram message.',
	inputSchema: telegramClearReactionInputSchema,
	outputSchema: telegramOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await client(ctx).clearReaction(input)
		return { ok: true }
	}
})

const sendMediaTool = defineTool({
	id: 'telegram-send-media',
	name: 'sendTelegramMedia',
	description:
		'Send one photo or document to a Telegram chat from a base64 body. For multiple related files use telegram-send-media-group.',
	inputSchema: telegramSendMediaInputSchema,
	outputSchema: telegramMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) =>
		client(ctx).sendMedia({
			chat_id: input.chat_id,
			kind: input.kind,
			body_base64: input.body_base64,
			file_name: input.file_name,
			...(input.caption === undefined ? {} : { caption: input.caption }),
			...(input.reply_to_message_id === undefined ? {} : { reply_to_message_id: input.reply_to_message_id }),
			...(input.content_type === undefined ? {} : { content_type: input.content_type })
		})
})

const sendMediaGroupTool = defineTool({
	id: 'telegram-send-media-group',
	name: 'sendTelegramMediaGroup',
	description: 'Send 2-10 photos or 2-10 documents as one Telegram media group. Cannot mix photo and document items.',
	inputSchema: telegramSendMediaGroupInputSchema,
	outputSchema: telegramSendMediaGroupOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) =>
		client(ctx).sendMediaGroup({
			chat_id: input.chat_id,
			items: input.items.map((item) => ({
				kind: item.kind,
				body_base64: item.body_base64,
				file_name: item.file_name,
				...(item.caption === undefined ? {} : { caption: item.caption }),
				...(item.content_type === undefined ? {} : { content_type: item.content_type })
			})),
			...(input.reply_to_message_id === undefined ? {} : { reply_to_message_id: input.reply_to_message_id })
		})
})

const downloadFileTool = defineTool({
	id: 'telegram-download-file',
	name: 'downloadTelegramFile',
	description: 'Download a Telegram file by file_id and return the body as base64 with optional size and name.',
	inputSchema: telegramDownloadFileInputSchema,
	outputSchema: telegramDownloadFileOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) =>
		encodeDownloadForTool(
			await client(ctx).downloadFile({
				file_id: input.file_id,
				...(input.file_name === undefined ? {} : { file_name: input.file_name })
			})
		)
})

const answerCallbackTool = defineTool({
	id: 'telegram-answer-callback',
	name: 'answerTelegramCallback',
	description: 'Acknowledge a Telegram callback query. Optional text shows a toast or alert to the user.',
	inputSchema: telegramAnswerCallbackInputSchema,
	outputSchema: telegramOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await client(ctx).answerCallback({
			callback_query_id: input.callback_query_id,
			...(input.text === undefined ? {} : { text: input.text }),
			...(input.show_alert === undefined ? {} : { show_alert: input.show_alert })
		})
		return { ok: true }
	}
})

const getBotTool = defineTool({
	id: 'telegram-get-bot',
	name: 'getTelegramBot',
	description: 'Return the bound bot identity (bot_id, username, display_name) via getMe.',
	inputSchema: emptyInputSchema,
	outputSchema: telegramGetBotOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (_input, ctx) => client(ctx).getBot()
})

export const telegramModule = defineModule({
	id: 'telegram',
	title: 'Telegram',
	description:
		'Telegram Bot API channel pack: send and edit text, media and media groups, chat actions, any-emoji reactions, file download, callback answers, and bot identity. Host binds bot_token; progressive live text uses createLiveMessage over sendText and editText.',
	runtime: 'both',
	auth: { type: 'custom', schema: telegramAuthSchema },
	tools: [
		sendTextTool,
		editTextTool,
		sendChatActionTool,
		setReactionTool,
		clearReactionTool,
		sendMediaTool,
		sendMediaGroupTool,
		downloadFileTool,
		answerCallbackTool,
		getBotTool
	]
})

export {
	answerCallbackTool,
	clearReactionTool,
	downloadFileTool,
	editTextTool,
	getBotTool,
	sendChatActionTool,
	sendMediaGroupTool,
	sendMediaTool,
	sendTextTool,
	setReactionTool
}
