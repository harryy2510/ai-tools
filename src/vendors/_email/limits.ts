import { ToolError } from '../../core/errors'
import { base64ToBytes, utf8ToBytes } from '../../shared/bytes'
import { recipientCount } from './address'
import type { NamedAddress } from './schemas'
import { MAX_EMAIL_BYTES } from './schemas'

export type EmailRecipients = {
	to: NamedAddress | NamedAddress[]
	cc?: NamedAddress | NamedAddress[] | undefined
	bcc?: NamedAddress | NamedAddress[] | undefined
}

/** Combined to/cc/bcc must stay within vendor limits (typically 50). */
export function assertRecipientLimit(input: EmailRecipients, max = 50): void {
	const total = recipientCount(input.to) + recipientCount(input.cc) + recipientCount(input.bcc)
	if (total > max) {
		throw new ToolError(`Combined to/cc/bcc recipients cannot exceed ${max}`, { code: 'bad_input' })
	}
}

/** Rough JSON payload + decoded attachment size check (default 5 MiB). */
export function assertEmailSize(
	payload: Record<string, unknown>,
	attachmentsBase64?: string[],
	maxBytes = MAX_EMAIL_BYTES
): void {
	let bytes = utf8ToBytes(JSON.stringify(payload)).byteLength
	if (attachmentsBase64 !== undefined) {
		for (const content of attachmentsBase64) {
			try {
				bytes += base64ToBytes(content).byteLength
			} catch (error) {
				throw new ToolError('Attachment content is not valid base64', {
					code: 'bad_input',
					cause: error
				})
			}
		}
	}
	if (bytes > maxBytes) {
		throw new ToolError('Email payload exceeds size limit', {
			code: 'too_large',
			details: { bytes, max_bytes: maxBytes }
		})
	}
}
