import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import { buildMimeTool, mimeModule, parseMimeTool } from '../../src/modules/mime'

describe('mime', () => {
	test('passes contracts', () => {
		expect(validateModule(mimeModule).ok).toBe(true)
	})

	test('build then parse round-trip', async () => {
		const built = await runTool(buildMimeTool, {
			from: { address: 'a@example.com', name: 'Ada' },
			to: 'b@example.com',
			subject: 'Hello',
			text: 'Plain body',
			html: '<p>Plain body</p>'
		})
		expect(built.raw).toContain('Subject:')
		expect(built.raw).toContain('Plain body')

		const parsed = await runTool(parseMimeTool, { raw: built.raw })
		expect(parsed.subject).toBe('Hello')
		expect(parsed.from?.address).toBe('a@example.com')
		expect(parsed.to?.[0]?.address).toBe('b@example.com')
		expect(parsed.text).toContain('Plain body')
		expect(parseMimeTool.id).toBe('mime-parse')
		expect(buildMimeTool.id).toBe('mime-build')
	})
})
