/**
 * Teams provider for the messaging seam. Wraps `TeamsClient`.
 */

import { ToolError } from '../../../core/errors'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { TeamsClient } from '../../../vendors/teams'
import type {
	MessagingAnswerCallbackInput,
	MessagingClearReactionInput,
	MessagingDownloadFileInput,
	MessagingDownloadFileOutput,
	MessagingEditTextInput,
	MessagingMessageOutput,
	MessagingOps,
	MessagingSendChatActionInput,
	MessagingSendMediaInput,
	MessagingSendTextInput,
	MessagingSetReactionInput,
	TeamsMessagingAuth
} from '../contracts'

export type TeamsMessagingProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

function requireServiceUrl(serviceUrl: string | undefined, method: string): string {
	if (!serviceUrl) {
		throw new ToolError(`${method} requires service_url when provider is teams`, { code: 'bad_input' })
	}
	return serviceUrl
}

export class TeamsMessagingProvider implements MessagingOps {
	readonly #client: TeamsClient

	constructor(auth: TeamsMessagingAuth, options: TeamsMessagingProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new TeamsClient(vendorAuth, options)
	}

	sendText(input: MessagingSendTextInput): Promise<MessagingMessageOutput> {
		const service_url = requireServiceUrl(input.service_url, 'messaging sendText')
		return this.#client.sendText({
			chat_id: input.chat_id,
			text: input.text,
			service_url,
			...(input.reply_to_message_id && { reply_to_message_id: input.reply_to_message_id }),
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		})
	}

	editText(input: MessagingEditTextInput): Promise<MessagingMessageOutput> {
		const service_url = requireServiceUrl(input.service_url, 'messaging editText')
		return this.#client.editText({
			chat_id: input.chat_id,
			message_id: input.message_id,
			text: input.text,
			service_url,
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		})
	}

	sendChatAction(input: MessagingSendChatActionInput): Promise<void> {
		const service_url = requireServiceUrl(input.service_url, 'messaging sendChatAction')
		return this.#client.sendChatAction({
			chat_id: input.chat_id,
			action: input.action,
			service_url
		})
	}

	setReaction(input: MessagingSetReactionInput): Promise<void> {
		return this.#client.setReaction({
			chat_id: input.chat_id,
			message_id: input.message_id,
			emoji: input.emoji
		})
	}

	clearReaction(input: MessagingClearReactionInput): Promise<void> {
		return this.#client.clearReaction({
			chat_id: input.chat_id,
			message_id: input.message_id
		})
	}

	sendMedia(input: MessagingSendMediaInput): Promise<MessagingMessageOutput> {
		const service_url = requireServiceUrl(input.service_url, 'messaging sendMedia')
		return this.#client.sendMedia({
			chat_id: input.chat_id,
			kind: input.kind,
			body_base64: input.body_base64,
			file_name: input.file_name,
			service_url,
			...(input.caption && { caption: input.caption }),
			...(input.reply_to_message_id && { reply_to_message_id: input.reply_to_message_id }),
			...(input.content_type && { content_type: input.content_type })
		})
	}

	downloadFile(input: MessagingDownloadFileInput): Promise<MessagingDownloadFileOutput> {
		return this.#client.downloadFile({
			file_id: input.file_id,
			...(input.file_name && { file_name: input.file_name }),
			...(input.service_url && { service_url: input.service_url })
		})
	}

	answerCallback(input: MessagingAnswerCallbackInput): Promise<void> {
		return this.#client.answerCallback({
			callback_query_id: input.callback_query_id,
			...(input.text && { text: input.text }),
			...(input.show_alert !== undefined && { show_alert: input.show_alert }),
			...(input.service_url && { service_url: input.service_url })
		})
	}
}
