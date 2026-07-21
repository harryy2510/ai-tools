import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import {
	mediaTypeExtensionTool,
	mediaTypeExtensionsTool,
	mediaTypeGetTool,
	mediaTypeModule
} from '../../src/modules/media-type'
import {
	allExtensionsFromMediaType,
	deriveOutputKey,
	extensionFromMediaType,
	mediaTypeFromPath,
	resolveFileExtension
} from '../../src/shared/media-type'

describe('media-type', () => {
	test('passes contracts', () => {
		expect(validateModule(mediaTypeModule).ok).toBe(true)
		expect(mediaTypeGetTool.id).toBe('media-type-get')
		expect(mediaTypeExtensionTool.id).toBe('media-type-extension')
		expect(mediaTypeExtensionsTool.id).toBe('media-type-extensions')
		expect(mediaTypeGetTool.meta.sideEffect).toBe('none')
	})

	test('getType tool resolves paths and extensions', async () => {
		const fromPath = await runTool(mediaTypeGetTool, { path: 'docs/report.pdf' })
		expect(fromPath.media_type).toBe('application/pdf')

		const fromExt = await runTool(mediaTypeGetTool, { path: 'json' })
		expect(fromExt.media_type).toBe('application/json')

		const unknown = await runTool(mediaTypeGetTool, { path: 'nope.unknownextxyz' })
		expect(unknown.media_type).toBeNull()
	})

	test('getExtension tools resolve MIME types', async () => {
		const one = await runTool(mediaTypeExtensionTool, {
			media_type: 'text/html; charset=utf-8'
		})
		expect(one.extension).toBe('html')

		const all = await runTool(mediaTypeExtensionsTool, { media_type: 'image/jpeg' })
		expect(all.extensions).toContain('jpg')
		expect(all.extensions).toContain('jpeg')
	})

	test('shared helpers match mime package behavior', () => {
		expect(mediaTypeFromPath('a.txt')).toBe('text/plain')
		expect(extensionFromMediaType('application/pdf')).toBe('pdf')
		expect(allExtensionsFromMediaType('image/jpeg').length).toBeGreaterThan(1)

		expect(resolveFileExtension({ filename: 'x.PDF' })).toBe('pdf')
		expect(resolveFileExtension({ mediaType: 'application/pdf' })).toBe('pdf')
		expect(resolveFileExtension({ mediaType: 'md' })).toBe('md')
		expect(resolveFileExtension({})).toBe('bin')

		expect(deriveOutputKey('docs/in.md', 'pdf', undefined)).toBe('docs/in.pdf')
		expect(deriveOutputKey('docs/in.md', '.png', undefined)).toBe('docs/in.png')
		expect(deriveOutputKey('docs/in.md', 'pdf', 'out/custom.pdf')).toBe('out/custom.pdf')
		expect(deriveOutputKey('bare', 'pdf', undefined)).toBe('bare.pdf')
	})
})
