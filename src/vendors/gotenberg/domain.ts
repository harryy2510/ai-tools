/**
 * Gotenberg form/path helpers (no HTTP).
 */

import { ToolError } from '../../core/errors'
import { toArrayBuffer } from '../../shared/bytes'
import type { GotenbergRenderSource } from './contracts'

export function appendSource(form: FormData, source: GotenbergRenderSource): void {
	if (source.html) {
		const bytes = new TextEncoder().encode(source.html)
		const blob = new Blob([toArrayBuffer(bytes)], { type: 'text/html' })
		form.append('files', blob, 'index.html')
		return
	}
	if (source.url) {
		form.append('url', source.url)
		return
	}
	throw new ToolError('Provide html or url', { code: 'bad_input' })
}

export function htmlPath(kind: 'pdf' | 'screenshot', source: GotenbergRenderSource): string {
	if (source.html) {
		return kind === 'pdf' ? '/forms/chromium/convert/html' : '/forms/chromium/screenshot/html'
	}
	return kind === 'pdf' ? '/forms/chromium/convert/url' : '/forms/chromium/screenshot/url'
}

export function defaultRenderKey(kind: 'pdf' | 'screenshot', outputKey: string | undefined): string {
	if (outputKey) return outputKey
	const stamp = Date.now()
	return kind === 'pdf' ? `renders/${stamp}.pdf` : `renders/${stamp}.png`
}
