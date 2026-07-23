import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import {
	cloudflareBrowserModule,
	cloudflareBrowserRenderPdfTool,
	cloudflareBrowserRenderScreenshotTool
} from '../../src/vendors/cloudflare-browser'

describe('cloudflare-browser', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(cloudflareBrowserModule).ok).toBe(true)
		expect(cloudflareBrowserModule.auth.type).toBe('custom')
		expect(cloudflareBrowserModule.tools.map((t) => t.id).sort()).toEqual([
			'cloudflare-browser-render-pdf',
			'cloudflare-browser-render-screenshot'
		])
		expect(cloudflareBrowserRenderPdfTool.id).toBe('cloudflare-browser-render-pdf')
		expect(cloudflareBrowserRenderScreenshotTool.id).toBe('cloudflare-browser-render-screenshot')
	})
})
