import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { documentExtractModule, documentExtractTextTool } from '../../src/modules/document-extract'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function amzTarget(input: RequestInfo | URL, init?: RequestInit): string {
	if (input instanceof Request) {
		return input.headers.get('X-Amz-Target') ?? input.headers.get('x-amz-target') ?? ''
	}
	const headers = init?.headers
	if (headers instanceof Headers) {
		return headers.get('X-Amz-Target') ?? headers.get('x-amz-target') ?? ''
	}
	if (headers !== undefined && !Array.isArray(headers) && typeof headers === 'object') {
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === 'x-amz-target' && typeof value === 'string') return value
		}
	}
	return ''
}

describe('document-extract', () => {
	test('passes contracts', () => {
		expect(validateModule(documentExtractModule).ok).toBe(true)
		expect(documentExtractTextTool.id).toBe('document-extract-text')
		expect(documentExtractModule.tools.some((t) => t.id === 'document-extract-text-batch')).toBe(true)
	})

	test('textract provider starts job and returns text when ready', async () => {
		const bound = withAuth(documentExtractModule, {
			provider: 'textract',
			accessKeyId: 'AKIAtest',
			secretAccessKey: 'secret',
			region: 'us-east-1',
			bucket: 'docs',
			poll_timeout_ms: 5_000,
			poll_interval_ms: 200
		})
		const tool = bound.tools.find((t) => t.id === 'document-extract-text')
		if (!tool) throw new Error('missing tool')

		let getCalls = 0
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				return new Response(JSON.stringify({ JobId: 'job-1' }), {
					status: 200,
					headers: { 'content-type': 'application/x-amz-json-1.1' }
				})
			}
			if (target.includes('GetDocumentTextDetection')) {
				getCalls += 1
				return new Response(
					JSON.stringify({
						JobStatus: 'SUCCEEDED',
						Blocks: [{ BlockType: 'LINE', Text: 'Hello page' }],
						DocumentMetadata: { Pages: 1 }
					}),
					{ status: 200, headers: { 'content-type': 'application/x-amz-json-1.1' } }
				)
			}
			return new Response(`unexpected target=${target}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					source: { store: 'object', key: 'inbox/a.pdf', filename: 'a.pdf' }
				})
			)
			expect(result['status']).toBe('succeeded')
			expect(result['job_id']).toBe('job-1')
			expect(result['text']).toContain('Hello page')
			expect(getCalls).toBeGreaterThan(0)
		} finally {
			globalThis.fetch = original
		}
	})
})
