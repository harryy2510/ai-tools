/**
 * Messaging seam client — picks telegram / slack / teams / imessage from host auth.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	MessagingAnswerCallbackInput,
	MessagingAuth,
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
} from './contracts'
import { messagingAuthSchema } from './contracts'
import { ImessageMessagingProvider } from './providers/imessage'
import { SlackMessagingProvider } from './providers/slack'
import { TeamsMessagingProvider } from './providers/teams'
import { TelegramMessagingProvider } from './providers/telegram'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: MessagingAuth, ctx: ToolContext): MessagingOps {
	const options = transportOptions(ctx)
	switch (auth.provider) {
		case 'telegram':
			return new TelegramMessagingProvider(auth, options)
		case 'slack':
			return new SlackMessagingProvider(auth, options)
		case 'teams':
			return new TeamsMessagingProvider(auth, options)
		case 'imessage':
			return new ImessageMessagingProvider(auth, options)
	}
}

export class MessagingClient implements MessagingOps {
	readonly #ops: MessagingOps

	constructor(ops: MessagingOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): MessagingClient {
		const auth = requireAuth(ctx, messagingAuthSchema)
		return new MessagingClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: MessagingAuth, ctx: ToolContext = {}): MessagingClient {
		return new MessagingClient(providerFor(auth, ctx))
	}

	sendText(input: MessagingSendTextInput): Promise<MessagingMessageOutput> {
		return this.#ops.sendText(input)
	}

	editText(input: MessagingEditTextInput): Promise<MessagingMessageOutput> {
		return this.#ops.editText(input)
	}

	sendChatAction(input: MessagingSendChatActionInput): Promise<void> {
		return this.#ops.sendChatAction(input)
	}

	setReaction(input: MessagingSetReactionInput): Promise<void> {
		return this.#ops.setReaction(input)
	}

	clearReaction(input: MessagingClearReactionInput): Promise<void> {
		return this.#ops.clearReaction(input)
	}

	sendMedia(input: MessagingSendMediaInput): Promise<MessagingMessageOutput> {
		return this.#ops.sendMedia(input)
	}

	downloadFile(input: MessagingDownloadFileInput): Promise<MessagingDownloadFileOutput> {
		return this.#ops.downloadFile(input)
	}

	answerCallback(input: MessagingAnswerCallbackInput): Promise<void> {
		return this.#ops.answerCallback(input)
	}
}
