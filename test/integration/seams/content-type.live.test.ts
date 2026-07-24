import { describe, expect, test } from 'bun:test'

import { mediaTypeFromPath, extensionFromMediaType } from '../../../src/shared/content-type'
import { runTool, withAuth } from '../../../src/core'
import { contentTypeModule } from '../../../src/modules/content-type'

/** Pure seam — always runs (no external service). */
describe('live seam content-type', () => {
	test('helpers + tool', async () => {
		expect(mediaTypeFromPath('a.pdf')).toBe('application/pdf')
		expect(extensionFromMediaType('image/png')).toBe('png')
		const bound = withAuth(contentTypeModule)
		const tool = bound.tools.find((t) => t.id === 'content-type-get')
		if (!tool) throw new Error('missing tool')
		const out = await runTool(tool, { path: 'report.docx' })
		expect(out).toBeDefined()
	})
})
