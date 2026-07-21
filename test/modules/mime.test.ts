import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import { buildMimeTool, mimeModule, parseMimeTool } from '../../src/modules/mime'
import { bytesToBase64, utf8ToBytes } from '../../src/shared/bytes'

describe('mime', () => {
	test('passes contracts', () => {
		expect(validateModule(mimeModule).ok).toBe(true)
	})

	test('build then parse round-trip with headers and attachment', async () => {
		const built = await runTool(buildMimeTool, {
			from: { address: 'a@example.com', name: 'Ada' },
			to: 'b@example.com',
			cc: 'c@example.com',
			subject: 'Hello',
			text: 'Plain body',
			html: '<p>Plain body</p>',
			headers: { 'X-Trace': 'trace-1' },
			attachments: [
				{
					filename: 'note.txt',
					content_type: 'text/plain',
					content_base64: bytesToBase64(utf8ToBytes('note body'))
				}
			]
		})
		expect(built.raw).toContain('Subject:')
		expect(built.raw).toContain('Plain body')
		expect(built.raw).toContain('X-Trace')
		expect(built.raw).toContain('note.txt')

		const parsed = await runTool(parseMimeTool, { raw: built.raw })
		expect(parsed.subject).toBe('Hello')
		expect(parsed.from?.address).toBe('a@example.com')
		expect(parsed.to?.[0]?.address).toBe('b@example.com')
		expect(parsed.cc?.[0]?.address).toBe('c@example.com')
		expect(parsed.text).toContain('Plain body')
		expect(parsed.headers?.some((h) => h.key === 'x-trace' && h.value.includes('trace-1'))).toBe(true)
		expect(parsed.attachments.length).toBeGreaterThanOrEqual(1)
		const att = parsed.attachments.find((a) => a.filename === 'note.txt')
		expect(att?.mimeType).toContain('text/plain')
		expect(att?.content_base64).toBeDefined()
		expect(parseMimeTool.id).toBe('mime-parse')
		expect(buildMimeTool.id).toBe('mime-build')
	})
})
