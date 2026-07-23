/**
 * iMessage provider for the messaging seam. Wraps `ImessageClient` (proxy REST).
 */

import { ToolError } from '../../../core/errors'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { ImessageClient } from '../../../vendors/imessage'
import type {
	ImessageMessagingAuth,
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
	MessagingSetReactionInput
} from '../contracts'

export type ImessageMessagingProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ImessageMessagingProvider implements MessagingOps {
	readonly #client: ImessageClient

	constructor(auth: ImessageMessagingAuth, options: ImessageMessagingProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new ImessageClient(
			{
				base_url: vendorAuth.base_url,
				project_id: vendorAuth.project_id,
				project_secret: vendorAuth.project_secret,
				...(vendorAuth.phone && { phone: vendorAuth.phone })
			},
			options
		)
	}

	async sendText(input: MessagingSendTextInput): Promise<MessagingMessageOutput> {
		const result = await this.#client.sendText({
			chat_id: input.chat_id,
			text: input.text
		})
		return {
			message_id: result.message_id ?? result.space_id
		}
	}

	async editText(input: MessagingEditTextInput): Promise<MessagingMessageOutput> {
		const result = await this.#client.editText({
			chat_id: input.chat_id,
			message_id: input.message_id,
			text: input.text
		})
		return {
			message_id: result.message_id ?? input.message_id
		}
	}

	sendChatAction(input: MessagingSendChatActionInput): Promise<void> {
		return this.#client.sendChatAction({
			chat_id: input.chat_id,
			action: input.action
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
		return this.#client.clearReaction({ chat_id: input.chat_id, message_id: input.message_id })
	}

	sendMedia(_input: MessagingSendMediaInput): Promise<MessagingMessageOutput> {
		throw new ToolError('iMessage proxy does not support sendMedia yet', { code: 'unsupported' })
	}

	downloadFile(_input: MessagingDownloadFileInput): Promise<MessagingDownloadFileOutput> {
		throw new ToolError('iMessage proxy does not support downloadFile yet', { code: 'unsupported' })
	}

	answerCallback(_input: MessagingAnswerCallbackInput): Promise<void> {
		return this.#client.answerCallback(_input)
	}
}
