/**
 * R2 REST payload helpers (CF envelope, size limits).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { MAX_OBJECT_BYTES } from './contracts'

export function assertCfEnvelope(data: unknown, operation: string): void {
	if (!isPlainObject(data)) return
	if (data['success'] !== false) return
	const errors = data['errors']
	let message = `R2 ${operation} failed`
	if (Array.isArray(errors) && errors.length > 0) {
		const first = errors[0]
		if (isPlainObject(first) && isString(first['message'])) {
			message = first['message']
		}
	}
	throw new ToolError(message, { code: 'upstream' })
}

export function assertSize(bytes: Uint8Array, kind: 'download' | 'upload'): void {
	if (bytes.byteLength <= MAX_OBJECT_BYTES) return
	throw new ToolError(`Object exceeds 5 MiB ${kind} limit`, {
		code: 'too_large',
		details: { max_bytes: MAX_OBJECT_BYTES, content_length: bytes.byteLength }
	})
}
