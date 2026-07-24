/**
 * Qdrant point-id helpers. Qdrant only accepts unsigned integers or UUIDs;
 * free-form string ids (e.g. RAG `doc#0`) are mapped to a deterministic UUID
 * and the original id is stored under `__logical_id` in the payload.
 */

import { createHash } from 'node:crypto'

import { isString } from 'es-toolkit'

export const QDRANT_LOGICAL_ID_KEY = '__logical_id'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UINT_RE = /^(0|[1-9]\d*)$/

/** Deterministic UUID (SHA-256 → RFC-like layout) for free-form logical ids. */
export function hashToUuid(value: string): string {
	const bytes = Uint8Array.from(createHash('sha256').update(value).digest().subarray(0, 16))
	const versionByte = bytes.at(6)
	const variantByte = bytes.at(8)
	if (versionByte === undefined || variantByte === undefined) {
		throw new Error('SHA-256 digest shorter than 16 bytes')
	}
	bytes[6] = (versionByte & 0x0f) | 0x50
	bytes[8] = (variantByte & 0x3f) | 0x80
	const hex = Buffer.from(bytes).toString('hex')
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** Map package logical point id → Qdrant wire id. */
export function toQdrantPointId(logicalId: string): string | number {
	if (UINT_RE.test(logicalId)) {
		const n = Number(logicalId)
		if (Number.isSafeInteger(n) && n >= 0) return n
	}
	if (UUID_RE.test(logicalId)) return logicalId.toLowerCase()
	return hashToUuid(logicalId)
}

export function isNativeQdrantId(logicalId: string): boolean {
	if (UINT_RE.test(logicalId)) {
		const n = Number(logicalId)
		return Number.isSafeInteger(n) && n >= 0
	}
	return UUID_RE.test(logicalId)
}

/** Prefer payload `__logical_id` when present so free-form ids round-trip. */
export function resolveLogicalPointId(wireId: string, payload: Record<string, unknown> | undefined): string {
	const logical = payload?.[QDRANT_LOGICAL_ID_KEY]
	if (isString(logical) && logical.length > 0) return logical
	return wireId
}

export function stripLogicalIdPayload(
	payload: Record<string, string | number | boolean | null> | undefined
): Record<string, string | number | boolean | null> | undefined {
	if (!payload) return undefined
	if (!(QDRANT_LOGICAL_ID_KEY in payload)) return payload
	const next: Record<string, string | number | boolean | null> = {}
	for (const [key, value] of Object.entries(payload)) {
		if (key === QDRANT_LOGICAL_ID_KEY) continue
		next[key] = value
	}
	return Object.keys(next).length > 0 ? next : undefined
}
