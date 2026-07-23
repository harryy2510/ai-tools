/**
 * iMessage provider for the messaging seam. Wraps `ImessageClient` (proxy REST).
 */

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

	async setReaction(input: MessagingSetReactionInput): Promise<void> {
		await this.#client.setReaction({
			chat_id: input.chat_id,
			message_id: input.message_id,
			emoji: input.emoji
		})
	}

	/**
	 * Spectrum clears reactions by unsending the reaction Message.
	 * Pass the reaction message_id returned by setReaction (vendor tool), not the target message id.
	 * Messaging seam setReaction is void — store reaction ids at the host when clearing later.
	 */
	clearReaction(input: MessagingClearReactionInput): Promise<void> {
		return this.#client.clearReaction({ chat_id: input.chat_id, message_id: input.message_id })
	}

	async sendMedia(input: MessagingSendMediaInput): Promise<MessagingMessageOutput> {
		const result = await this.#client.sendMedia({
			chat_id: input.chat_id,
			kind: input.kind,
			body_base64: input.body_base64,
			file_name: input.file_name,
			...(input.caption && { caption: input.caption }),
			...(input.content_type && { content_type: input.content_type })
		})
		return {
			message_id: result.message_id ?? result.space_id
		}
	}

	/**
	 * `file_id` is the Spectrum message id of the attachment. Messaging seam has no chat_id on download;
	 * pass space id in file_id as `space_id|message_id` is not used — host should use vendor download when needed.
	 * When service_url is unused, require chat context via file_name optional and... actually messaging download only has file_id.
	 *
	 * For iMessage, chat_id must be known. We accept file_id as `space_id::message_id` composite, or
	 * use chat_id if the messaging contract is extended. Prefer composite: space::file.
	 */
	async downloadFile(input: MessagingDownloadFileInput): Promise<MessagingDownloadFileOutput> {
		const composite = splitImessageFileRef(input.file_id)
		const result = await this.#client.downloadFile({
			file_id: composite.file_id,
			chat_id: composite.chat_id,
			...(input.file_name && { file_name: input.file_name })
		})
		return result
	}

	answerCallback(_input: MessagingAnswerCallbackInput): Promise<void> {
		return this.#client.answerCallback(_input)
	}
}

/**
 * Messaging download has no chat_id field. Encode space + message as `space_id::message_id`,
 * or pass a bare message_id only when the host cannot (then client requires chat_id and throws).
 */
function splitImessageFileRef(fileId: string): { chat_id?: string; file_id: string } {
	const sep = '::'
	const idx = fileId.indexOf(sep)
	if (idx <= 0) {
		return { file_id: fileId }
	}
	const chat_id = fileId.slice(0, idx)
	const rest = fileId.slice(idx + sep.length)
	if (chat_id.length === 0 || rest.length === 0) {
		return { file_id: fileId }
	}
	return { chat_id, file_id: rest }
}
