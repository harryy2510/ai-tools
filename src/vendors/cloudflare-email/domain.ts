import { isNil, isString } from 'es-toolkit'
import { castArray } from 'es-toolkit/compat'

import { ToolError } from '../../core/errors'
import { base64ToBytes, utf8ToBytes } from '../../shared/bytes'
import { MAX_EMAIL_BYTES } from './contracts'
import type { CloudflareEmailSendInput, NamedAddress } from './contracts'

export function normalizeAddressObject(item: NamedAddress): string | { email: string; name?: string } {
	if (isString(item)) return item
	return item.name === undefined ? { email: item.email } : { email: item.email, name: item.name }
}

export function normalizeAddressObjectList(
	value: NamedAddress | NamedAddress[] | undefined
): Array<string | { email: string; name?: string }> | undefined {
	if (isNil(value)) return undefined
	return castArray(value).map(normalizeAddressObject)
}

export function recipientCount(value: NamedAddress | NamedAddress[] | undefined): number {
	if (isNil(value)) return 0
	return castArray(value).length
}

export function assertRecipientLimit(input: CloudflareEmailSendInput): void {
	const total = recipientCount(input.to) + recipientCount(input.cc) + recipientCount(input.bcc)
	if (total > 50) {
		throw new ToolError('Combined to/cc/bcc recipients cannot exceed 50', { code: 'bad_input' })
	}
}

export function assertEmailSize(payload: Record<string, unknown>, attachmentsBase64?: string[]): void {
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
	if (bytes > MAX_EMAIL_BYTES) {
		throw new ToolError('Email payload exceeds 5 MiB limit', {
			code: 'too_large',
			details: { bytes, max_bytes: MAX_EMAIL_BYTES }
		})
	}
}
