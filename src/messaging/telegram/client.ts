/**
 * Telegram Bot API — same shape as other providers:
 *   createTelegramService(auth, ctx)  → ofetch endpoint methods
 *   createTelegramClient(...)         → domain map (ChannelTransport + extras)
 *
 * No raw fetch. No dynamic method router.
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import type { FetchLike, ToolContext } from '../../core/types'
import { base64ToBytes, bytesToBase64, toArrayBuffer } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type {
	ChannelAnswerCallbackInput,
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
import type { TelegramAuth, TelegramSendMediaGroupInput } from './contracts'

const TELEGRAM_API_BASE = 'https://api.telegram.org'
const MAX_MEDIA_BYTES = 20 * 1024 * 1024

export type TelegramFailureKind = 'definite_rejection' | 'outcome_unknown'

export class TelegramClientError extends ToolError {
	readonly failureKind: TelegramFailureKind
	readonly method: string
	readonly status: number | undefined
	readonly retryAfterSeconds: number | undefined

	constructor(input: {
		message: string
		failureKind: TelegramFailureKind
		method: string
		status?: number
		retryAfterSeconds?: number
		cause?: unknown
	}) {
		super(input.message, {
			code: 'upstream',
			retryable: input.failureKind === 'outcome_unknown',
			cause: input.cause,
			details: {
				method: input.method,
				failure_kind: input.failureKind,
				...(input.status === undefined ? {} : { status: input.status }),
				...(input.retryAfterSeconds === undefined ? {} : { retry_after_seconds: input.retryAfterSeconds })
			}
		})
		this.name = 'TelegramClientError'
		this.failureKind = input.failureKind
		this.method = input.method
		this.status = input.status
		this.retryAfterSeconds = input.retryAfterSeconds
	}
}

export function isTelegramDefiniteRejection(error: unknown): boolean {
	return error instanceof TelegramClientError && error.failureKind === 'definite_rejection'
}

export function isTelegramOutcomeUnknown(error: unknown): boolean {
	return error instanceof TelegramClientError && error.failureKind === 'outcome_unknown'
}

/**
 * Endpoint methods only. noThrow so Telegram `{ ok, description }` envelope can be read.
 */
function createTelegramService(auth: TelegramAuth, ctx: ToolContext) {
	const inject = {
		...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch }),
		...(ctx.signal === undefined ? {} : { signal: ctx.signal })
	}
	const api = new HttpService({
		baseURL: `${TELEGRAM_API_BASE}/bot${auth.bot_token}`,
		label: 'Telegram',
		...inject
	})
	const files = new HttpService({
		baseURL: `${TELEGRAM_API_BASE}/file/bot${auth.bot_token}`,
		label: 'Telegram',
		...inject
	})

	const post = async (label: string, path: string, body: FormData | Record<string, unknown> = {}) => {
		const res = await api.post(path, body, { label, noThrow: true })
		return telegramResult(label, res.status, res.data)
	}

	return {
		getMe: () => post('Telegram getMe', '/getMe'),
		getWebhookInfo: () => post('Telegram getWebhookInfo', '/getWebhookInfo'),
		setWebhook: (body: Record<string, unknown>) => post('Telegram setWebhook', '/setWebhook', body),
		deleteWebhook: (body: Record<string, unknown>) => post('Telegram deleteWebhook', '/deleteWebhook', body),
		sendMessage: (body: Record<string, unknown>) => post('Telegram sendMessage', '/sendMessage', body),
		editMessageText: (body: Record<string, unknown>) => post('Telegram editMessageText', '/editMessageText', body),
		sendChatAction: (body: Record<string, unknown>) => post('Telegram sendChatAction', '/sendChatAction', body),
		setMessageReaction: (body: Record<string, unknown>) =>
			post('Telegram setMessageReaction', '/setMessageReaction', body),
		answerCallbackQuery: (body: Record<string, unknown>) =>
			post('Telegram answerCallbackQuery', '/answerCallbackQuery', body),
		getFile: (body: Record<string, unknown>) => post('Telegram getFile', '/getFile', body),
		sendPhoto: (body: FormData) => post('Telegram sendPhoto', '/sendPhoto', body),
		sendDocument: (body: FormData) => post('Telegram sendDocument', '/sendDocument', body),
		sendMediaGroup: (body: FormData) => post('Telegram sendMediaGroup', '/sendMediaGroup', body),
		downloadFileBytes: async (filePath: string): Promise<Uint8Array> => {
			const path = `/${filePath.replace(/^\/+/, '')}`
			const res = await files.bytes('GET', path, { label: 'Telegram downloadFile', noThrow: true })
			if (!res.ok) {
				throw new TelegramClientError({
					message: `Telegram downloadFile failed with HTTP ${res.status}`,
					failureKind: isDefiniteStatus(res.status) ? 'definite_rejection' : 'outcome_unknown',
					method: 'downloadFile',
					status: res.status
				})
			}
			return res.bytes
		}
	}
}

type TelegramService = ReturnType<typeof createTelegramService>

/** Parse Telegram `{ ok, result | description }` after HTTP (may be non-2xx). */
function telegramResult(label: string, status: number, data: unknown): unknown {
	if (!isPlainObject(data) || typeof data['ok'] !== 'boolean') {
		throw new TelegramClientError({
			message: `${label} returned an invalid envelope`,
			failureKind: 'outcome_unknown',
			method: label
		})
	}
	if (status >= 200 && status < 300 && data['ok'] === true && data['result'] !== undefined) {
		return data['result']
	}
	const parameters = data['parameters']
	const retryAfter =
		isPlainObject(parameters) && typeof parameters['retry_after'] === 'number' ? parameters['retry_after'] : undefined
	throw new TelegramClientError({
		message: isString(data['description']) ? data['description'] : `${label} failed`,
		failureKind: isDefiniteStatus(status) ? 'definite_rejection' : 'outcome_unknown',
		method: label,
		status,
		...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter })
	})
}

function isDefiniteStatus(status: number): boolean {
	return status === 400 || status === 401 || status === 403 || status === 404
}

// --- Domain client (maps ChannelTransport + Telegram-only ops onto the service) ---

export type TelegramClientOptions = {
	botToken: string
	fetch?: FetchLike
	signal?: AbortSignal
}

export type TelegramBotIdentity = {
	bot_id: string
	username: string
	display_name: string
}

export type TelegramWebhookInfo = {
	url: string
	pending_update_count: number
	last_error_at_unix: number | undefined
	last_error_message: string | undefined
}

export type TelegramClient = ChannelTransport & {
	getBot: () => Promise<TelegramBotIdentity>
	getWebhookInfo: () => Promise<TelegramWebhookInfo>
	setWebhook: (input: { url: string; secret_token: string; allowed_updates?: string[] }) => Promise<void>
	deleteWebhook: (input?: { drop_pending_updates?: boolean }) => Promise<void>
	sendMediaGroup: (input: TelegramSendMediaGroupInput) => Promise<{ message_ids: string[] }>
}

export function createTelegramClient(options: TelegramClientOptions): TelegramClient {
	const auth: TelegramAuth = { bot_token: options.botToken }
	const ctx: ToolContext = {
		...(options.fetch === undefined ? {} : { fetch: options.fetch }),
		...(options.signal === undefined ? {} : { signal: options.signal })
	}
	return bindClient(createTelegramService(auth, ctx))
}

export function createTelegramClientFromAuth(auth: TelegramAuth, ctx: ToolContext = {}): TelegramClient {
	return bindClient(createTelegramService(auth, ctx))
}

function bindClient(svc: TelegramService): TelegramClient {
	return {
		sendText: async (input: ChannelSendTextInput): Promise<ChannelMessageRef> => {
			const body: Record<string, unknown> = { chat_id: input.chat_id, text: input.text }
			if (input.reply_to_message_id !== undefined) {
				body['reply_parameters'] = { message_id: Number.parseInt(input.reply_to_message_id, 10) }
			}
			if (input.reply_markup !== undefined) body['reply_markup'] = input.reply_markup
			return { message_id: String(asMessage(await svc.sendMessage(body)).message_id) }
		},

		editText: async (input: ChannelEditTextInput): Promise<ChannelMessageRef> => {
			const body: Record<string, unknown> = {
				chat_id: input.chat_id,
				message_id: Number.parseInt(input.message_id, 10),
				text: input.text
			}
			if (input.reply_markup !== undefined) body['reply_markup'] = input.reply_markup
			return { message_id: String(asMessage(await svc.editMessageText(body)).message_id) }
		},

		sendChatAction: async (input: ChannelSendChatActionInput): Promise<void> => {
			asTrue(await svc.sendChatAction({ chat_id: input.chat_id, action: input.action }))
		},

		setReaction: async (input: ChannelSetReactionInput): Promise<void> => {
			asTrue(
				await svc.setMessageReaction({
					chat_id: input.chat_id,
					message_id: Number.parseInt(input.message_id, 10),
					reaction: [{ type: 'emoji', emoji: input.emoji }]
				})
			)
		},

		clearReaction: async (input: ChannelClearReactionInput): Promise<void> => {
			asTrue(
				await svc.setMessageReaction({
					chat_id: input.chat_id,
					message_id: Number.parseInt(input.message_id, 10),
					reaction: []
				})
			)
		},

		sendMedia: async (input: ChannelSendMediaInput): Promise<ChannelMessageRef> => {
			const formData = fileForm(input)
			const result = input.kind === 'photo' ? await svc.sendPhoto(formData) : await svc.sendDocument(formData)
			return { message_id: String(asMessage(result).message_id) }
		},

		downloadFile: async (input: ChannelDownloadFileInput): Promise<ChannelDownloadFileResult> => {
			const file = asFile(await svc.getFile({ file_id: input.file_id }))
			const bytes = await svc.downloadFileBytes(file.file_path)
			return {
				file_name: input.file_name ?? file.file_path.split('/').pop() ?? input.file_id,
				file_size: file.file_size,
				bytes
			}
		},

		answerCallback: async (input: ChannelAnswerCallbackInput): Promise<void> => {
			const body: Record<string, unknown> = { callback_query_id: input.callback_query_id }
			if (input.text !== undefined) body['text'] = input.text
			if (input.show_alert !== undefined) body['show_alert'] = input.show_alert
			asTrue(await svc.answerCallbackQuery(body))
		},

		getBot: async () => {
			const me = asBot(await svc.getMe())
			return { bot_id: String(me.id), username: me.username, display_name: me.first_name }
		},

		getWebhookInfo: async () => {
			const info = asWebhookInfo(await svc.getWebhookInfo())
			return {
				url: info.url,
				pending_update_count: info.pending_update_count,
				last_error_at_unix: info.last_error_date,
				last_error_message: info.last_error_message
			}
		},

		setWebhook: async (input) => {
			asTrue(
				await svc.setWebhook({
					url: input.url,
					secret_token: input.secret_token,
					allowed_updates: input.allowed_updates ?? ['message', 'callback_query']
				})
			)
		},

		deleteWebhook: async (input) => {
			asTrue(await svc.deleteWebhook({ drop_pending_updates: input?.drop_pending_updates ?? false }))
		},

		sendMediaGroup: async (input: TelegramSendMediaGroupInput) => {
			if (input.items.length < 2 || input.items.length > 10) {
				throw new ToolError('Media groups require between 2 and 10 items', { code: 'bad_input' })
			}
			const hasDoc = input.items.some((item) => item.kind === 'document')
			const hasPhoto = input.items.some((item) => item.kind === 'photo')
			if (hasDoc && hasPhoto) {
				throw new ToolError('Media groups cannot mix photo and document items', { code: 'bad_input' })
			}
			const formData = new FormData()
			formData.set('chat_id', input.chat_id)
			if (input.reply_to_message_id !== undefined) {
				formData.set('reply_parameters', JSON.stringify({ message_id: Number.parseInt(input.reply_to_message_id, 10) }))
			}
			const media = input.items.map((item, index) => {
				const bytes = decodeBase64(item.body_base64)
				const blob =
					item.content_type === undefined
						? new Blob([toArrayBuffer(bytes)])
						: new Blob([toArrayBuffer(bytes)], { type: item.content_type })
				formData.set(`file${index}`, blob, item.file_name)
				return {
					type: item.kind,
					media: `attach://file${index}`,
					...(item.caption === undefined ? {} : { caption: item.caption })
				}
			})
			formData.set('media', JSON.stringify(media))
			const messages = asMessages(await svc.sendMediaGroup(formData))
			return { message_ids: messages.map((m) => String(m.message_id)) }
		}
	}
}

function fileForm(input: ChannelSendMediaInput): FormData {
	const bytes = decodeBase64(input.body_base64)
	const formData = new FormData()
	formData.set('chat_id', input.chat_id)
	const field = input.kind === 'photo' ? 'photo' : 'document'
	const blob =
		input.content_type === undefined
			? new Blob([toArrayBuffer(bytes)])
			: new Blob([toArrayBuffer(bytes)], { type: input.content_type })
	formData.set(field, blob, input.file_name)
	if (input.caption !== undefined) formData.set('caption', input.caption)
	if (input.reply_to_message_id !== undefined) {
		formData.set('reply_parameters', JSON.stringify({ message_id: Number.parseInt(input.reply_to_message_id, 10) }))
	}
	return formData
}

function decodeBase64(bodyBase64: string): Uint8Array {
	let bytes: Uint8Array
	try {
		bytes = base64ToBytes(bodyBase64)
	} catch (error) {
		throw new ToolError('Invalid base64 body', { code: 'bad_input', cause: error })
	}
	if (bytes.byteLength === 0) {
		throw new ToolError('Media body must not be empty', { code: 'bad_input' })
	}
	if (bytes.byteLength > MAX_MEDIA_BYTES) {
		throw new ToolError('Media exceeds 20 MiB limit', {
			code: 'too_large',
			details: { max_bytes: MAX_MEDIA_BYTES, content_length: bytes.byteLength }
		})
	}
	return bytes
}

function asMessage(value: unknown): { message_id: number } {
	if (!isPlainObject(value) || typeof value['message_id'] !== 'number') {
		throw new ToolError('Telegram returned an invalid message', { code: 'upstream' })
	}
	return { message_id: value['message_id'] }
}

function asMessages(value: unknown): Array<{ message_id: number }> {
	if (!Array.isArray(value)) {
		throw new ToolError('Telegram returned an invalid message list', { code: 'upstream' })
	}
	return value.map(asMessage)
}

function asTrue(value: unknown): true {
	if (value !== true) {
		throw new ToolError('Telegram returned unexpected result', { code: 'upstream' })
	}
	return true
}

function asBot(value: unknown): { id: number; username: string; first_name: string } {
	if (
		!isPlainObject(value) ||
		typeof value['id'] !== 'number' ||
		!isString(value['username']) ||
		!isString(value['first_name'])
	) {
		throw new ToolError('Telegram getMe returned invalid bot identity', { code: 'upstream' })
	}
	return { id: value['id'], username: value['username'], first_name: value['first_name'] }
}

function asWebhookInfo(value: unknown): {
	url: string
	pending_update_count: number
	last_error_date?: number
	last_error_message?: string
} {
	if (!isPlainObject(value) || !isString(value['url']) || typeof value['pending_update_count'] !== 'number') {
		throw new ToolError('Telegram getWebhookInfo returned invalid payload', { code: 'upstream' })
	}
	return {
		url: value['url'],
		pending_update_count: value['pending_update_count'],
		...(typeof value['last_error_date'] === 'number' ? { last_error_date: value['last_error_date'] } : {}),
		...(isString(value['last_error_message']) ? { last_error_message: value['last_error_message'] } : {})
	}
}

function asFile(value: unknown): { file_path: string; file_size?: number } {
	if (!isPlainObject(value) || !isString(value['file_path'])) {
		throw new ToolError('Telegram getFile returned invalid payload', { code: 'upstream' })
	}
	return {
		file_path: value['file_path'],
		...(typeof value['file_size'] === 'number' ? { file_size: value['file_size'] } : {})
	}
}

export function encodeDownloadForTool(result: ChannelDownloadFileResult): {
	file_name: string
	file_size?: number
	body_base64: string
} {
	return {
		file_name: result.file_name,
		...(result.file_size === undefined ? {} : { file_size: result.file_size }),
		body_base64: bytesToBase64(result.bytes)
	}
}
