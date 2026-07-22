import { z } from 'zod'

import type {
	ChannelAnswerCallbackInput,
	ChannelChatAction,
	ChannelClearReactionInput,
	ChannelDownloadFileInput,
	ChannelDownloadFileResult,
	ChannelEditTextInput,
	ChannelMessageRef,
	ChannelSendChatActionInput,
	ChannelSendMediaInput,
	ChannelSendTextInput,
	ChannelSetReactionInput,
	ChannelTransport
} from '../channel-transport'

export const telegramChatActionSchema = z.enum([
	'typing',
	'upload_photo',
	'record_video',
	'upload_video',
	'record_voice',
	'upload_voice',
	'upload_document',
	'choose_sticker',
	'find_location',
	'record_video_note',
	'upload_video_note'
])

export const telegramAuthSchema = z.object({
	bot_token: z.string().min(1).describe('Telegram bot token from BotFather (host-bound; never from model input)')
})

export type TelegramAuth = z.infer<typeof telegramAuthSchema>

export const telegramSendTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Telegram chat id (string form of the numeric id)'),
	text: z.string().min(1).max(4096).describe('Message text (max 4096 characters)'),
	reply_to_message_id: z.string().min(1).optional().describe('Optional message id to reply to'),
	reply_markup: z.unknown().optional().describe('Optional Telegram reply markup object')
})

export const telegramMessageOutputSchema = z.object({
	message_id: z.string().describe('Telegram message id as string')
})

export const telegramEditTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Telegram chat id'),
	message_id: z.string().min(1).describe('Message id to edit'),
	text: z.string().min(1).max(4096).describe('Replacement text (max 4096 characters)'),
	reply_markup: z.unknown().optional().describe('Optional Telegram reply markup object')
})

export const telegramSendChatActionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Telegram chat id'),
	action: telegramChatActionSchema.describe('Chat action shown to the user (typing, upload_photo, …)')
})

export const telegramSetReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Telegram chat id'),
	message_id: z.string().min(1).describe('Message id to react to'),
	emoji: z.string().min(1).max(32).describe('Any emoji reaction Telegram accepts for this bot/chat')
})

export const telegramClearReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Telegram chat id'),
	message_id: z.string().min(1).describe('Message id to clear reactions on')
})

export const telegramSendMediaInputSchema = z.object({
	chat_id: z.string().min(1).describe('Telegram chat id'),
	kind: z.enum(['photo', 'document']).describe('Media kind'),
	body_base64: z.string().min(1).describe('File body as base64'),
	file_name: z.string().min(1).describe('File name including extension'),
	caption: z.string().max(1024).optional().describe('Optional caption (max 1024 characters)'),
	reply_to_message_id: z.string().min(1).optional().describe('Optional message id to reply to'),
	content_type: z.string().optional().describe('Optional MIME type for the upload')
})

export const telegramDownloadFileInputSchema = z.object({
	file_id: z.string().min(1).describe('Telegram file_id from an inbound attachment'),
	file_name: z.string().min(1).optional().describe('Preferred file name for the download result')
})

export const telegramDownloadFileOutputSchema = z.object({
	file_name: z.string(),
	file_size: z.number().optional(),
	body_base64: z.string().describe('Downloaded file body as base64')
})

export const telegramAnswerCallbackInputSchema = z.object({
	callback_query_id: z.string().min(1).describe('callback_query.id from an inbound update'),
	text: z.string().max(200).optional().describe('Optional notification text shown to the user'),
	show_alert: z.boolean().optional().describe('When true, show an alert instead of a toast')
})

export const telegramSendMediaGroupItemSchema = z.object({
	kind: z.enum(['photo', 'document']).describe('Media kind; all items must be photo or all document'),
	body_base64: z.string().min(1).describe('File body as base64'),
	file_name: z.string().min(1).describe('File name including extension'),
	caption: z.string().max(1024).optional().describe('Optional caption on this item'),
	content_type: z.string().optional().describe('Optional MIME type')
})

export const telegramSendMediaGroupInputSchema = z.object({
	chat_id: z.string().min(1).describe('Telegram chat id'),
	items: z
		.array(telegramSendMediaGroupItemSchema)
		.min(2)
		.max(10)
		.describe('2-10 media items; cannot mix photo and document'),
	reply_to_message_id: z.string().min(1).optional().describe('Optional message id to reply to')
})

export const telegramSendMediaGroupOutputSchema = z.object({
	message_ids: z.array(z.string()).describe('Message ids for each media item')
})

export const telegramGetBotOutputSchema = z.object({
	bot_id: z.string(),
	username: z.string(),
	display_name: z.string()
})

export const telegramOkOutputSchema = z.object({
	ok: z.boolean()
})

export type TelegramSendTextInput = z.infer<typeof telegramSendTextInputSchema>
export type TelegramEditTextInput = z.infer<typeof telegramEditTextInputSchema>
export type TelegramSendChatActionInput = z.infer<typeof telegramSendChatActionInputSchema>
export type TelegramSetReactionInput = z.infer<typeof telegramSetReactionInputSchema>
export type TelegramClearReactionInput = z.infer<typeof telegramClearReactionInputSchema>
export type TelegramSendMediaInput = z.infer<typeof telegramSendMediaInputSchema>
export type TelegramDownloadFileInput = z.infer<typeof telegramDownloadFileInputSchema>
export type TelegramAnswerCallbackInput = z.infer<typeof telegramAnswerCallbackInputSchema>
export type TelegramSendMediaGroupInput = z.infer<typeof telegramSendMediaGroupInputSchema>

export type {
	ChannelAnswerCallbackInput,
	ChannelChatAction,
	ChannelClearReactionInput,
	ChannelDownloadFileInput,
	ChannelDownloadFileResult,
	ChannelEditTextInput,
	ChannelMessageRef,
	ChannelSendChatActionInput,
	ChannelSendMediaInput,
	ChannelSendTextInput,
	ChannelSetReactionInput,
	ChannelTransport
}
