/**
 * Pure RAG helpers: text chunking (no HTTP).
 */

import { DEFAULT_CHUNK_MAX_CHARS, DEFAULT_CHUNK_OVERLAP } from './contracts'

export type ChunkOptions = {
	max_chars?: number | undefined
	overlap?: number | undefined
}

/**
 * Split text into overlapping character windows.
 * Prefers paragraph then newline boundaries when a soft break exists near the end of a window.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
	const maxChars = options.max_chars ?? DEFAULT_CHUNK_MAX_CHARS
	const overlap = Math.min(options.overlap ?? DEFAULT_CHUNK_OVERLAP, Math.max(0, maxChars - 1))
	const normalized = text.replace(/\r\n/g, '\n').trim()
	if (normalized.length === 0) return []
	if (normalized.length <= maxChars) return [normalized]

	const chunks: string[] = []
	let start = 0
	while (start < normalized.length) {
		let end = Math.min(start + maxChars, normalized.length)
		if (end < normalized.length) {
			const window = normalized.slice(start, end)
			const para = window.lastIndexOf('\n\n')
			const line = window.lastIndexOf('\n')
			const soft = para >= maxChars * 0.5 ? para : line >= maxChars * 0.5 ? line : -1
			if (soft > 0) {
				end = start + soft
			}
		}
		const piece = normalized.slice(start, end).trim()
		if (piece.length > 0) chunks.push(piece)
		if (end >= normalized.length) break
		const next = end - overlap
		start = next <= start ? end : next
	}
	return chunks
}

export function chunkId(documentId: string, index: number): string {
	return `${documentId}#${index}`
}
