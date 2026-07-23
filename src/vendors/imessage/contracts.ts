import { z } from 'zod'

/**
 * Host auth for the hosted photon-rest-proxy (REST → Spectrum gRPC).
 * Credentials are forwarded per request; the proxy stores nothing.
 */
export const imessageAuthSchema = z.object({
	base_url: z
		.string()
		.url()
		.describe('Origin of the hosted photon-rest-proxy, for example https://photon-proxy.example.com'),
	project_id: z.string().min(1).describe('Spectrum project id (sent as x-spectrum-project-id)'),
	project_secret: z.string().min(1).describe('Spectrum project secret (sent as x-spectrum-project-secret)'),
	phone: z
		.string()
		.min(1)
		.optional()
		.describe('Optional default iMessage line phone when the project has multiple lines')
})

export type ImessageAuth = z.infer<typeof imessageAuthSchema>

export const imessageChatActionSchema = z.enum([
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

export const imessageSendTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Spectrum space id (iMessage chat GUID)'),
	text: z.string().min(1).describe('Message text'),
	phone: z.string().min(1).optional().describe('Optional line phone override for multi-line projects')
})

export const imessageMessageOutputSchema = z.object({
	message_id: z.string().optional().describe('Provider message id when returned'),
	space_id: z.string().describe('Spectrum space id')
})

export const imessageEditTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Spectrum space id'),
	message_id: z.string().min(1).describe('Message id to edit'),
	text: z.string().min(1).describe('Replacement text'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageSendChatActionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Spectrum space id'),
	action: imessageChatActionSchema.describe('Chat action; non-typing values map to typing start'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageSetReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Spectrum space id'),
	message_id: z.string().min(1).describe('Message id to react to'),
	emoji: z.string().min(1).max(64).describe('Emoji or tapback name the channel accepts'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageUnsendInputSchema = z.object({
	chat_id: z.string().min(1).describe('Spectrum space id'),
	message_id: z.string().min(1).describe('Message id to unsend'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageReadInputSchema = z.object({
	chat_id: z.string().min(1).describe('Spectrum space id'),
	message_id: z.string().min(1).describe('Mark read up to this message id'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageOkOutputSchema = z.object({
	ok: z.boolean(),
	space_id: z.string().optional()
})

export type ImessageSendTextInput = z.infer<typeof imessageSendTextInputSchema>
export type ImessageMessageOutput = z.infer<typeof imessageMessageOutputSchema>
export type ImessageEditTextInput = z.infer<typeof imessageEditTextInputSchema>
export type ImessageSendChatActionInput = z.infer<typeof imessageSendChatActionInputSchema>
export type ImessageSetReactionInput = z.infer<typeof imessageSetReactionInputSchema>
export type ImessageUnsendInput = z.infer<typeof imessageUnsendInputSchema>
export type ImessageReadInput = z.infer<typeof imessageReadInputSchema>
