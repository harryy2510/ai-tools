import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import { mimeModule, mimePingTool } from '../../src/modules/mime'

describe('mime', () => {
	test('passes contracts', () => {
		expect(validateModule(mimeModule).ok).toBe(true)
	})

	test('ping', async () => {
		const result = await runTool(mimePingTool, {})
		expect(result).toEqual({ ok: true })
	})
})
