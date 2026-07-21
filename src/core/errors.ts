export type ToolErrorCode =
	| 'bad_input'
	| 'bad_auth'
	| 'forbidden'
	| 'not_found'
	| 'rate_limited'
	| 'upstream'
	| 'timeout'
	| 'too_large'
	| 'unsupported'
	| 'unsupported_runtime'
	| 'internal'

export type ToolErrorOptions = {
	cause?: unknown
	code: ToolErrorCode
	details?: Record<string, unknown>
	retryable?: boolean
}

export class ToolError extends Error {
	readonly code: ToolErrorCode
	readonly details: Record<string, unknown> | undefined
	readonly retryable: boolean

	constructor(message: string, options: ToolErrorOptions) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause })
		this.name = 'ToolError'
		this.code = options.code
		this.details = options.details
		this.retryable = options.retryable ?? false
	}
}

export function isToolError(error: unknown): error is ToolError {
	return error instanceof ToolError
}
