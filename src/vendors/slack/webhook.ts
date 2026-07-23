import { createHmac, timingSafeEqual } from 'node:crypto'

import { isPlainObject, isString } from 'es-toolkit'

/**
 * Verify Slack request signature (X-Slack-Signature).
 * HMAC-SHA256 of `v0:{timestamp}:{raw_body}` compared to `v0={hex}`.
 * Rejects empty inputs and timestamps older/newer than maxAgeSeconds (default 5 minutes).
 */
export function verifySlackRequestSignature(input: {
	signing_secret: string
	raw_body: string
	timestamp: string
	signature: string
	/** Max clock skew in seconds. Default 300 (Slack recommendation). */
	maxAgeSeconds?: number
	/** Clock override for tests. */
	nowSeconds?: number
}): boolean {
	const { signing_secret, raw_body, timestamp, signature } = input
	if (!signing_secret || !timestamp || !signature) return false
	if (!/^\d+$/.test(timestamp)) return false

	const maxAge = input.maxAgeSeconds ?? 300
	const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
	const ts = Number.parseInt(timestamp, 10)
	if (!Number.isFinite(ts) || Math.abs(now - ts) > maxAge) return false

	const base = `v0:${timestamp}:${raw_body}`
	const digest = createHmac('sha256', signing_secret).update(base, 'utf8').digest('hex')
	const expected = `v0=${digest}`

	const a = Buffer.from(expected, 'utf8')
	const b = Buffer.from(signature, 'utf8')
	if (a.byteLength !== b.byteLength) return false
	return timingSafeEqual(a, b)
}

export type SlackInboundMedia = {
	kind: string
	ref?: string
	media_type?: string
	file_name?: string
	file_size?: number
	unique_ref?: string
}

/** Package-owned normalized inbound event for host routing. */
export type SlackInboundEvent = {
	channel: 'slack'
	event_id: string
	chat_id: string
	user_id?: string
	message_id?: string
	text?: string
	media?: SlackInboundMedia[]
	reply_to?: string
	raw_type: string
	received_at: string
	/** Interactive response_url when raw_type is an interaction. */
	callback_query_id?: string
	/** Opaque action value / callback data when present. */
	callback_data?: string
	username?: string
	chat_type?: string
	team_id?: string
}

export type ParseSlackEventResult =
	| { ok: true; event: SlackInboundEvent }
	| { ok: true; challenge: string }
	| { ok: false; reason: string }

/**
 * Parse one raw Slack Events API / interactive body into a normalized inbound event.
 * Handles url_verification challenges, event_callback messages, and interactive payloads.
 */
export function parseSlackEvent(
	body: unknown,
	options?: { received_at?: string; allow_group_chats?: boolean }
): ParseSlackEventResult {
	if (isString(body)) {
		return parseSlackEvent(tryParseJson(body) ?? tryParsePayloadForm(body) ?? body, options)
	}
	if (!isPlainObject(body)) {
		return { ok: false, reason: 'body_not_object' }
	}

	const receivedAt = options?.received_at ?? new Date().toISOString()
	const allowGroups = options?.allow_group_chats ?? true

	if (body['type'] === 'url_verification' && isString(body['challenge'])) {
		return { ok: true, challenge: body['challenge'] }
	}

	if (body['type'] === 'event_callback' && isPlainObject(body['event'])) {
		return parseEventCallback(body, body['event'], receivedAt, allowGroups)
	}

	if (isInteractionType(body['type'])) {
		return parseInteraction(body, receivedAt)
	}

	// Some hosts pass the inner event object only.
	if (isString(body['type']) && (body['type'] === 'message' || body['type'] === 'app_mention')) {
		const teamId = isString(body['team']) ? body['team'] : undefined
		return parseMessageEvent(body, {
			eventId: firstString(body['event_ts'], body['ts']) ?? 'unknown',
			receivedAt,
			allowGroups,
			rawType: body['type'],
			...(teamId && { teamId })
		})
	}

	return { ok: false, reason: 'unsupported_event_type' }
}

function parseEventCallback(
	envelope: Record<string, unknown>,
	event: Record<string, unknown>,
	receivedAt: string,
	allowGroups: boolean
): ParseSlackEventResult {
	const eventId = firstString(envelope['event_id'], event['event_ts'], event['ts'])
	if (!eventId) return { ok: false, reason: 'missing_event_id' }
	const teamId = isString(envelope['team_id']) ? envelope['team_id'] : undefined
	const type = isString(event['type']) ? event['type'] : 'unknown'

	if (type === 'message' || type === 'app_mention') {
		return parseMessageEvent(event, {
			eventId,
			receivedAt,
			allowGroups,
			rawType: type,
			...(teamId && { teamId })
		})
	}

	return { ok: false, reason: 'unsupported_event_type' }
}

function parseMessageEvent(
	event: Record<string, unknown>,
	ctx: {
		eventId: string
		teamId?: string
		receivedAt: string
		allowGroups: boolean
		rawType: string
	}
): ParseSlackEventResult {
	// Bot message echoes / message_changed noise — skip subtypes except file_share.
	const subtype = isString(event['subtype']) ? event['subtype'] : undefined
	if (subtype && subtype !== 'file_share') {
		return { ok: false, reason: 'unsupported_message_subtype' }
	}

	const chatId = firstString(event['channel'])
	if (!chatId) return { ok: false, reason: 'missing_channel' }

	const channelType = firstString(event['channel_type'])
	if (!ctx.allowGroups && channelType && channelType !== 'im' && channelType !== 'mpim') {
		return { ok: false, reason: 'non_dm_chat' }
	}

	const userId = firstString(event['user'])
	const messageId = firstString(event['ts'])
	const text = firstString(event['text'])
	const media = collectMedia(event)
	const replyTo = firstString(event['thread_ts'])
	// thread_ts equals ts for root messages; only surface as reply_to when different.
	const replyToParent = replyTo && messageId && replyTo !== messageId ? replyTo : undefined

	if (!text && media.length === 0) {
		return { ok: false, reason: 'empty_message' }
	}

	const inbound: SlackInboundEvent = {
		channel: 'slack',
		event_id: ctx.eventId,
		chat_id: chatId,
		raw_type: ctx.rawType,
		received_at: ctx.receivedAt,
		...(userId && { user_id: userId }),
		...(messageId && { message_id: messageId }),
		...(text && { text }),
		...(media.length > 0 && { media }),
		...(replyToParent && { reply_to: replyToParent }),
		...(channelType && { chat_type: channelType }),
		...(ctx.teamId && { team_id: ctx.teamId })
	}
	return { ok: true, event: inbound }
}

function parseInteraction(body: Record<string, unknown>, receivedAt: string): ParseSlackEventResult {
	const type = isString(body['type']) ? body['type'] : 'interaction'
	const channel = body['channel']
	const chatId = isPlainObject(channel) ? firstString(channel['id']) : firstString(body['channel_id'], body['channel'])
	if (!chatId) return { ok: false, reason: 'interaction_missing_channel' }

	const user = body['user']
	const userId = isPlainObject(user) ? firstString(user['id']) : firstString(body['user_id'])
	const username = isPlainObject(user) ? firstString(user['username'], user['name']) : undefined

	const message = body['message']
	const messageId = isPlainObject(message) ? firstString(message['ts']) : firstString(body['message_ts'])

	const responseUrl = firstString(body['response_url'])
	const callbackData = extractCallbackData(body)
	const team = body['team']
	const teamId = isPlainObject(team) ? firstString(team['id']) : firstString(body['team_id'])
	const eventId = firstString(body['trigger_id'], responseUrl, messageId) ?? `${type}:${chatId}`

	const inbound: SlackInboundEvent = {
		channel: 'slack',
		event_id: eventId,
		chat_id: chatId,
		raw_type: type,
		received_at: receivedAt,
		...(userId && { user_id: userId }),
		...(username && { username }),
		...(messageId && { message_id: messageId }),
		...(responseUrl && { callback_query_id: responseUrl }),
		...(callbackData && { callback_data: callbackData }),
		...(teamId && { team_id: teamId })
	}
	return { ok: true, event: inbound }
}

function extractCallbackData(body: Record<string, unknown>): string | undefined {
	const actions = body['actions']
	if (Array.isArray(actions) && actions.length > 0) {
		const first = actions[0]
		if (isPlainObject(first)) {
			const selected = first['selected_option']
			const selectedValue = isPlainObject(selected) ? selected['value'] : undefined
			return firstString(first['value'], first['action_id'], selectedValue)
		}
	}
	const view = body['view']
	if (isPlainObject(view) && isString(view['callback_id'])) {
		return view['callback_id']
	}
	return firstString(body['callback_id'])
}

function collectMedia(event: Record<string, unknown>): SlackInboundMedia[] {
	const out: SlackInboundMedia[] = []
	const files = event['files']
	if (!Array.isArray(files)) return out
	for (const file of files) {
		if (!isPlainObject(file) || !isString(file['id'])) continue
		const mimetype = isString(file['mimetype']) ? file['mimetype'] : undefined
		const kind = mimetype?.startsWith('image/') ? 'photo' : 'document'
		out.push({
			kind,
			ref: file['id'],
			...(isString(file['name']) && { file_name: file['name'] }),
			...(typeof file['size'] === 'number' && { file_size: file['size'] }),
			...(mimetype && { media_type: mimetype }),
			...(isString(file['file_access']) && { unique_ref: file['file_access'] })
		})
	}
	return out
}

function isInteractionType(type: unknown): boolean {
	return (
		type === 'block_actions' ||
		type === 'interactive_message' ||
		type === 'shortcut' ||
		type === 'message_action' ||
		type === 'view_submission' ||
		type === 'view_closed' ||
		type === 'slash_command'
	)
}

function tryParseJson(raw: string): unknown {
	try {
		return JSON.parse(raw)
	} catch {
		return undefined
	}
}

/** Interactive endpoints often post `payload=<urlencoded json>`. */
function tryParsePayloadForm(raw: string): unknown {
	if (!raw.includes('payload=')) return undefined
	try {
		const params = new URLSearchParams(raw)
		const payload = params.get('payload')
		if (!payload) return undefined
		return JSON.parse(payload)
	} catch {
		return undefined
	}
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (isString(value) && value.length > 0) return value
	}
	return undefined
}
