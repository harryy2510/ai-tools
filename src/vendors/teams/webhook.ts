import { isPlainObject, isString } from 'es-toolkit'

/**
 * Host-owned Bot Framework JWT validation is authoritative.
 * This helper only checks that an Authorization Bearer token is present
 * (length > 0 after the scheme). Do not treat a true result as cryptographic
 * authenticity.
 */
export function verifyTeamsAuthHeader(headerValue: string | null | undefined): boolean {
	if (!headerValue) return false
	const match = /^Bearer\s+(\S+)$/i.exec(headerValue.trim())
	return Boolean(match?.[1] && match[1].length > 0)
}

export type TeamsInboundMedia = {
	kind: string
	ref?: string
	media_type?: string
	file_name?: string
	file_size?: number
}

/** Package-owned normalized inbound event for host routing. */
export type TeamsInboundEvent = {
	channel: 'teams'
	event_id: string
	chat_id: string
	user_id?: string
	message_id?: string
	text?: string
	media?: TeamsInboundMedia[]
	reply_to?: string
	raw_type: string
	received_at: string
	/** Connector service URL for outbound replies in this conversation. */
	service_url?: string
	/** Invoke id / reply path when raw_type is invoke. */
	callback_query_id?: string
	/** Opaque invoke value / action data when present. */
	callback_data?: string
	username?: string
	chat_type?: string
}

export type ParseTeamsActivityResult = { ok: true; event: TeamsInboundEvent } | { ok: false; reason: string }

/** True when value looks like a Bot Framework activity object. */
export function isTeamsActivity(value: unknown): value is Record<string, unknown> {
	if (!isPlainObject(value)) return false
	if (!isString(value['type']) || value['type'].length === 0) return false
	const conversation = value['conversation']
	return isPlainObject(conversation) && isString(conversation['id']) && conversation['id'].length > 0
}

/**
 * Parse one raw Bot Framework Activity into a normalized inbound event.
 * Returns ok:false for payloads the pack does not surface.
 */
export function parseTeamsActivity(body: unknown, options?: { received_at?: string }): ParseTeamsActivityResult {
	if (!isPlainObject(body)) {
		return { ok: false, reason: 'activity_not_object' }
	}
	if (!isString(body['type']) || body['type'].length === 0) {
		return { ok: false, reason: 'missing_type' }
	}

	const conversation = body['conversation']
	if (!isPlainObject(conversation) || !isString(conversation['id']) || conversation['id'].length === 0) {
		return { ok: false, reason: 'missing_conversation' }
	}

	const receivedAt = options?.received_at ?? new Date().toISOString()
	const rawType = body['type']
	const activityId = isString(body['id']) && body['id'].length > 0 ? body['id'] : undefined
	const eventId = activityId ?? `${rawType}:${conversation['id']}:${receivedAt}`
	const serviceUrl = isString(body['serviceUrl']) && body['serviceUrl'].length > 0 ? body['serviceUrl'] : undefined

	const from = body['from']
	const userId = isPlainObject(from) && isString(from['id']) ? from['id'] : undefined
	const username = isPlainObject(from) && isString(from['name']) ? from['name'] : undefined
	const text = firstString(body['text'], body['summary'])
	const replyTo = isString(body['replyToId']) && body['replyToId'].length > 0 ? body['replyToId'] : undefined
	const media = collectMedia(body)
	const conversationType =
		isString(conversation['conversationType']) && conversation['conversationType'].length > 0
			? conversation['conversationType']
			: undefined

	if (rawType === 'invoke') {
		const callbackData = encodeCallbackData(body['value'])
		const event: TeamsInboundEvent = {
			channel: 'teams',
			event_id: eventId,
			chat_id: conversation['id'],
			raw_type: 'invoke',
			received_at: receivedAt,
			callback_query_id: activityId ?? eventId,
			...(userId && { user_id: userId }),
			...(username && { username }),
			...(activityId && { message_id: activityId }),
			...(callbackData && { callback_data: callbackData }),
			...(serviceUrl && { service_url: serviceUrl }),
			...(conversationType && { chat_type: conversationType })
		}
		return { ok: true, event }
	}

	if (rawType === 'message' || rawType === 'messageUpdate') {
		if (!text && media.length === 0) {
			return { ok: false, reason: 'empty_message' }
		}
		const event: TeamsInboundEvent = {
			channel: 'teams',
			event_id: eventId,
			chat_id: conversation['id'],
			raw_type: rawType,
			received_at: receivedAt,
			...(userId && { user_id: userId }),
			...(username && { username }),
			...(activityId && { message_id: activityId }),
			...(text && { text }),
			...(media.length > 0 && { media }),
			...(replyTo && { reply_to: replyTo }),
			...(serviceUrl && { service_url: serviceUrl }),
			...(conversationType && { chat_type: conversationType })
		}
		return { ok: true, event }
	}

	// Surface conversationUpdate / typing / others with minimal fields for host filters.
	const event: TeamsInboundEvent = {
		channel: 'teams',
		event_id: eventId,
		chat_id: conversation['id'],
		raw_type: rawType,
		received_at: receivedAt,
		...(userId && { user_id: userId }),
		...(username && { username }),
		...(activityId && { message_id: activityId }),
		...(text && { text }),
		...(serviceUrl && { service_url: serviceUrl }),
		...(conversationType && { chat_type: conversationType })
	}
	return { ok: true, event }
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (isString(value) && value.length > 0) return value
	}
	return undefined
}

function encodeCallbackData(value: unknown): string | undefined {
	if (isString(value) && value.length > 0) return value
	if (isPlainObject(value)) {
		try {
			return JSON.stringify(value)
		} catch {
			return undefined
		}
	}
	return undefined
}

function collectMedia(activity: Record<string, unknown>): TeamsInboundMedia[] {
	const out: TeamsInboundMedia[] = []
	const attachments = activity['attachments']
	if (!Array.isArray(attachments)) return out

	for (const item of attachments) {
		if (!isPlainObject(item)) continue
		const contentType = isString(item['contentType']) ? item['contentType'] : undefined
		const contentUrl = isString(item['contentUrl']) ? item['contentUrl'] : undefined
		const name = isString(item['name']) ? item['name'] : undefined
		if (!contentUrl && !contentType && !name) continue
		const kind =
			contentType && contentType.startsWith('image/')
				? 'photo'
				: contentType && contentType.startsWith('audio/')
					? 'audio'
					: contentType && contentType.startsWith('video/')
						? 'video'
						: 'document'
		out.push({
			kind,
			...(contentUrl && { ref: contentUrl }),
			...(contentType && { media_type: contentType }),
			...(name && { file_name: name })
		})
	}
	return out
}
