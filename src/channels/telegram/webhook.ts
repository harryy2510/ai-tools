import { isPlainObject, isString } from 'es-toolkit'

/**
 * Verify Telegram webhook secret header (x-telegram-bot-api-secret-token).
 * Exact string match; constant-time comparison when lengths match.
 */
export function verifyTelegramWebhookSecret(headerValue: string | null | undefined, expectedSecret: string): boolean {
	if (headerValue === null || headerValue === undefined) return false
	if (expectedSecret.length === 0) return false
	if (headerValue.length !== expectedSecret.length) return false

	let mismatch = 0
	for (let i = 0; i < headerValue.length; i += 1) {
		mismatch |= headerValue.charCodeAt(i) ^ expectedSecret.charCodeAt(i)
	}
	return mismatch === 0
}

export type TelegramInboundMedia = {
	kind: string
	ref?: string
	media_type?: string
	file_name?: string
	file_size?: number
	unique_ref?: string
}

/** Package-owned normalized inbound event for host routing. */
export type TelegramInboundEvent = {
	channel: 'telegram'
	event_id: string
	chat_id: string
	user_id?: string
	message_id?: string
	text?: string
	media?: TelegramInboundMedia[]
	reply_to?: string
	raw_type: string
	received_at: string
	/** Present when Telegram groups media into an album. */
	media_group_id?: string
	/** Callback query id when raw_type is callback_query. */
	callback_query_id?: string
	/** Opaque callback data when present. */
	callback_data?: string
	username?: string
	chat_type?: string
}

export type ParseTelegramUpdateResult = { ok: true; event: TelegramInboundEvent } | { ok: false; reason: string }

/**
 * Parse one raw Bot API Update into a normalized inbound event.
 * Returns ok:false for updates the pack does not surface (unsupported chat types, empty noise).
 */
export function parseTelegramUpdate(
	update: unknown,
	options?: { received_at?: string; allow_group_chats?: boolean }
): ParseTelegramUpdateResult {
	if (!isPlainObject(update)) {
		return { ok: false, reason: 'update_not_object' }
	}
	const updateId = update['update_id']
	if (typeof updateId !== 'number') {
		return { ok: false, reason: 'missing_update_id' }
	}

	const receivedAt = options?.received_at ?? new Date().toISOString()
	const allowGroups = options?.allow_group_chats ?? false

	const message = asMessage(update['message']) ?? asMessage(update['edited_message'])
	if (message !== undefined) {
		return parseMessageUpdate(updateId, message, receivedAt, allowGroups, update['edited_message'] !== undefined)
	}

	const callback = update['callback_query']
	if (isPlainObject(callback)) {
		return parseCallbackUpdate(updateId, callback, receivedAt, allowGroups)
	}

	return { ok: false, reason: 'unsupported_update_type' }
}

function parseMessageUpdate(
	updateId: number,
	message: Record<string, unknown>,
	receivedAt: string,
	allowGroups: boolean,
	edited: boolean
): ParseTelegramUpdateResult {
	const chat = message['chat']
	if (!isPlainObject(chat) || typeof chat['id'] !== 'number') {
		return { ok: false, reason: 'missing_chat' }
	}
	const chatType = isString(chat['type']) ? chat['type'] : undefined
	if (!allowGroups && chatType !== undefined && chatType !== 'private') {
		return { ok: false, reason: 'non_private_chat' }
	}

	const from = message['from']
	const userId = isPlainObject(from) && typeof from['id'] === 'number' ? String(from['id']) : undefined
	const username = isPlainObject(from) && isString(from['username']) ? from['username'] : undefined
	const messageId = typeof message['message_id'] === 'number' ? String(message['message_id']) : undefined
	const text = firstString(message['text'], message['caption'])
	const media = collectMedia(message)
	const replyTo =
		isPlainObject(message['reply_to_message']) && typeof message['reply_to_message']['message_id'] === 'number'
			? String(message['reply_to_message']['message_id'])
			: undefined
	const mediaGroupId = isString(message['media_group_id']) ? message['media_group_id'] : undefined

	if (text === undefined && media.length === 0) {
		return { ok: false, reason: 'empty_message' }
	}

	const event: TelegramInboundEvent = {
		channel: 'telegram',
		event_id: String(updateId),
		chat_id: String(chat['id']),
		raw_type: edited ? 'edited_message' : 'message',
		received_at: receivedAt,
		...(userId === undefined ? {} : { user_id: userId }),
		...(username === undefined ? {} : { username }),
		...(messageId === undefined ? {} : { message_id: messageId }),
		...(text === undefined ? {} : { text }),
		...(media.length === 0 ? {} : { media }),
		...(replyTo === undefined ? {} : { reply_to: replyTo }),
		...(mediaGroupId === undefined ? {} : { media_group_id: mediaGroupId }),
		...(chatType === undefined ? {} : { chat_type: chatType })
	}
	return { ok: true, event }
}

function parseCallbackUpdate(
	updateId: number,
	callback: Record<string, unknown>,
	receivedAt: string,
	allowGroups: boolean
): ParseTelegramUpdateResult {
	const message = asMessage(callback['message'])
	const chat = message !== undefined ? message['chat'] : undefined
	if (!isPlainObject(chat) || typeof chat['id'] !== 'number') {
		return { ok: false, reason: 'callback_missing_chat' }
	}
	const chatType = isString(chat['type']) ? chat['type'] : undefined
	if (!allowGroups && chatType !== undefined && chatType !== 'private') {
		return { ok: false, reason: 'non_private_chat' }
	}

	const from = callback['from']
	const userId = isPlainObject(from) && typeof from['id'] === 'number' ? String(from['id']) : undefined
	const username = isPlainObject(from) && isString(from['username']) ? from['username'] : undefined
	const callbackQueryId = isString(callback['id']) ? callback['id'] : undefined
	if (callbackQueryId === undefined) {
		return { ok: false, reason: 'callback_missing_id' }
	}
	const callbackData = isString(callback['data']) ? callback['data'] : undefined
	const messageId =
		message !== undefined && typeof message['message_id'] === 'number' ? String(message['message_id']) : undefined

	const event: TelegramInboundEvent = {
		channel: 'telegram',
		event_id: String(updateId),
		chat_id: String(chat['id']),
		raw_type: 'callback_query',
		received_at: receivedAt,
		callback_query_id: callbackQueryId,
		...(userId === undefined ? {} : { user_id: userId }),
		...(username === undefined ? {} : { username }),
		...(messageId === undefined ? {} : { message_id: messageId }),
		...(callbackData === undefined ? {} : { callback_data: callbackData }),
		...(chatType === undefined ? {} : { chat_type: chatType })
	}
	return { ok: true, event }
}

function asMessage(value: unknown): Record<string, unknown> | undefined {
	return isPlainObject(value) ? value : undefined
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (isString(value) && value.length > 0) return value
	}
	return undefined
}

function collectMedia(message: Record<string, unknown>): TelegramInboundMedia[] {
	const out: TelegramInboundMedia[] = []

	const photo = message['photo']
	if (Array.isArray(photo) && photo.length > 0) {
		const largest = photo[photo.length - 1]
		if (isPlainObject(largest) && isString(largest['file_id'])) {
			out.push({
				kind: 'photo',
				ref: largest['file_id'],
				...(isString(largest['file_unique_id']) ? { unique_ref: largest['file_unique_id'] } : {}),
				...(typeof largest['file_size'] === 'number' ? { file_size: largest['file_size'] } : {}),
				media_type: 'image/jpeg'
			})
		}
	}

	for (const key of ['document', 'audio', 'video', 'voice', 'video_note', 'animation', 'sticker'] as const) {
		const item = message[key]
		if (!isPlainObject(item) || !isString(item['file_id'])) continue
		out.push({
			kind: key,
			ref: item['file_id'],
			...(isString(item['file_unique_id']) ? { unique_ref: item['file_unique_id'] } : {}),
			...(typeof item['file_size'] === 'number' ? { file_size: item['file_size'] } : {}),
			...(isString(item['file_name']) ? { file_name: item['file_name'] } : {}),
			...(isString(item['mime_type']) ? { media_type: item['mime_type'] } : {})
		})
	}

	return out
}
