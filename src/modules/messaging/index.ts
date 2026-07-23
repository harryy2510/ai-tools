/**
 * Public messaging seam surface.
 * Internals (providers/*) stay private.
 */

export { MessagingClient } from './client'
export {
	messagingAnswerCallbackTool,
	messagingAuthSchema,
	messagingClearReactionTool,
	messagingDownloadFileTool,
	messagingEditTextTool,
	messagingModule,
	messagingSendChatActionTool,
	messagingSendMediaTool,
	messagingSendTextTool,
	messagingSetReactionTool
} from './module'
export type { MessagingAuth } from './module'
export type {
	MessagingAnswerCallbackInput,
	MessagingClearReactionInput,
	MessagingDownloadFileInput,
	MessagingDownloadFileOutput,
	MessagingEditTextInput,
	MessagingMessageOutput,
	MessagingSendChatActionInput,
	MessagingSendMediaInput,
	MessagingSendTextInput,
	MessagingSetReactionInput,
	ImessageMessagingAuth,
	SlackMessagingAuth,
	TeamsMessagingAuth,
	TelegramMessagingAuth
} from './contracts'
export {
	messagingAnswerCallbackInputSchema,
	messagingChatActionSchema,
	messagingClearReactionInputSchema,
	messagingDownloadFileInputSchema,
	messagingDownloadFileOutputSchema,
	messagingEditTextInputSchema,
	messagingMessageOutputSchema,
	messagingOkOutputSchema,
	messagingSendChatActionInputSchema,
	messagingSendMediaInputSchema,
	messagingSendTextInputSchema,
	messagingSetReactionInputSchema
} from './contracts'
export { createLiveMessage, createTypingPulse } from '../../vendors/_messaging'
export type { LiveMessage, LiveMessageDeps, TypingPulse, TypingPulseDeps } from '../../vendors/_messaging'
