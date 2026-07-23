/**
 * Textract payload helpers (blocks, job status, sleep).
 */

import { isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'

export function lineTextFromBlocks(payload: Record<string, unknown>): {
	text: string
	page_count?: number
} {
	const blocks = payload['Blocks']
	const lines: string[] = []
	if (isArray(blocks)) {
		for (const block of blocks) {
			if (!isPlainObject(block)) continue
			if (block['BlockType'] !== 'LINE') continue
			const t = block['Text']
			if (isString(t) && t.length > 0) lines.push(t)
		}
	}
	const meta = payload['DocumentMetadata']
	let page_count: number | undefined
	if (isPlainObject(meta) && typeof meta['Pages'] === 'number' && Number.isFinite(meta['Pages'])) {
		page_count = meta['Pages']
	}
	return {
		text: lines.join('\n'),
		...(page_count !== undefined && { page_count })
	}
}

export function mapJobStatus(jobStatus: string): 'succeeded' | 'pending' | 'failed' {
	if (jobStatus === 'SUCCEEDED' || jobStatus === 'PARTIAL_SUCCESS') return 'succeeded'
	if (jobStatus === 'FAILED') return 'failed'
	return 'pending'
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'))
			return
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		const onAbort = () => {
			clearTimeout(timer)
			reject(new DOMException('Aborted', 'AbortError'))
		}
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}
