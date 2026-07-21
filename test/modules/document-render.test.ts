import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { documentRenderModule, documentRenderPdfTool } from '../../src/modules/document-render'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

const storageAuth = {
	provider: 's3' as const,
	accessKeyId: 'AKIAtest',
	secretAccessKey: 'secret',
	region: 'auto',
	bucket: 'artifacts',
	endpoint: 'https://example.r2.cloudflarestorage.com'
}

describe('document-render', () => {
	test('passes contracts', () => {
		expect(validateModule(documentRenderModule).ok).toBe(true)
		expect(documentRenderPdfTool.id).toBe('document-render-pdf')
		expect(documentRenderModule.tools.some((t) => t.id === 'document-render-screenshot')).toBe(true)
	})

	test('gotenberg provider renders PDF and writes to storage', async () => {
		const bound = withAuth(documentRenderModule, {
			provider: 'gotenberg',
			gotenberg_base_url: 'https://gotenberg.example',
			storage: storageAuth
		})
		const tool = bound.tools.find((t) => t.id === 'document-render-pdf')
		if (!tool) throw new Error('missing tool')

		const pdfBytes = new TextEncoder().encode('%PDF-1.4 fake')
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			if (url.includes('gotenberg.example') && method === 'POST') {
				expect(url).toContain('/forms/chromium/convert/html')
				return new Response(pdfBytes, {
					status: 200,
					headers: { 'content-type': 'application/pdf' }
				})
			}
			if (url.includes('artifacts') && method === 'PUT') {
				return new Response(null, { status: 200 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					source: { html: '<html><body>Hi</body></html>' },
					output_key: 'renders/test.pdf',
					filename: 'test.pdf'
				})
			)
			expect(result['kind']).toBe('pdf')
			const out = result['result']
			expect(isPlainObject(out)).toBe(true)
			if (isPlainObject(out)) {
				expect(out['store']).toBe('object')
				expect(out['key']).toBe('renders/test.pdf')
				expect(out['media_type']).toBe('application/pdf')
				expect(out['byte_length']).toBe(pdfBytes.byteLength)
			}
		} finally {
			globalThis.fetch = original
		}
	})

	test('cloudflare-browser provider captures screenshot', async () => {
		const bound = withAuth(documentRenderModule, {
			provider: 'cloudflare-browser',
			accountId: 'acc',
			apiToken: 'tok',
			storage: storageAuth
		})
		const tool = bound.tools.find((t) => t.id === 'document-render-screenshot')
		if (!tool) throw new Error('missing tool')

		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2])
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
			if (url.includes('browser-rendering/screenshot') && method === 'POST') {
				return new Response(png, {
					status: 200,
					headers: { 'content-type': 'image/png' }
				})
			}
			if (url.includes('artifacts') && method === 'PUT') {
				return new Response(null, { status: 200 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					source: { html: '<p>shot</p>' },
					output_key: 'renders/shot.png'
				})
			)
			expect(result['kind']).toBe('screenshot')
			const out = result['result']
			if (isPlainObject(out)) {
				expect(out['key']).toBe('renders/shot.png')
				expect(out['media_type']).toBe('image/png')
			}
		} finally {
			globalThis.fetch = original
		}
	})
})
