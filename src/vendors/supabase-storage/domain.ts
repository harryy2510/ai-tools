/**
 * Supabase Storage payload helpers (size limits, body decode).
 */

import { ToolError } from '../../core/errors'
import { bytesToBase64, bytesToUtf8 } from '../../shared/bytes'
import { MAX_OBJECT_BYTES } from './contracts'

export function decodeBody(bytes: Uint8Array, encoding: 'base64' | 'utf8'): string {
	return encoding === 'utf8' ? bytesToUtf8(bytes) : bytesToBase64(bytes)
}

export function assertSize(bytes: Uint8Array, kind: 'download' | 'upload'): void {
	if (bytes.byteLength <= MAX_OBJECT_BYTES) return
	throw new ToolError(`Object exceeds 5 MiB ${kind} limit`, {
		code: 'too_large',
		details: { max_bytes: MAX_OBJECT_BYTES, content_length: bytes.byteLength }
	})
}
