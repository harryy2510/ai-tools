import { describe, expect, test } from 'bun:test'

import { runTool, withAuth } from '../../../src/core'
import { mimeModule } from '../../../src/modules/mime'

describe('live seam mime', () => {
	test('ping tool', async () => {
		const bound = withAuth(mimeModule)
		const tool = bound.tools.find((t) => t.id === 'mime-ping')
		if (!tool) throw new Error('missing mime-ping')
		const out = await runTool(tool, {})
		expect(out).toEqual({ ok: true })
	})
})
