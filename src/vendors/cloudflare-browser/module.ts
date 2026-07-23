import { defineModule, defineTool } from '../../core/define'
import { CloudflareBrowserClient } from './client'
import {
	cloudflareBrowserAuthSchema,
	cloudflareBrowserRenderOutputSchema,
	cloudflareBrowserRenderPdfInputSchema,
	cloudflareBrowserRenderScreenshotInputSchema
} from './contracts'

export const cloudflareBrowserRenderPdfTool = defineTool({
	id: 'cloudflare-browser-render-pdf',
	name: 'cloudflareBrowserRenderPdf',
	description:
		'Render HTML or a URL to a PDF via Cloudflare Browser Rendering. Writes the PDF to object storage and returns an ArtifactRef.',
	inputSchema: cloudflareBrowserRenderPdfInputSchema,
	outputSchema: cloudflareBrowserRenderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => CloudflareBrowserClient.fromContext(ctx).renderPdf(input)
})

export const cloudflareBrowserRenderScreenshotTool = defineTool({
	id: 'cloudflare-browser-render-screenshot',
	name: 'cloudflareBrowserRenderScreenshot',
	description:
		'Capture a PNG screenshot of HTML or a URL via Cloudflare Browser Rendering. Writes the image to object storage and returns an ArtifactRef.',
	inputSchema: cloudflareBrowserRenderScreenshotInputSchema,
	outputSchema: cloudflareBrowserRenderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => CloudflareBrowserClient.fromContext(ctx).renderScreenshot(input)
})

export const cloudflareBrowserModule = defineModule({
	id: 'cloudflare-browser',
	title: 'Cloudflare Browser Rendering',
	description:
		'Cloudflare Browser Rendering vendor pack: HTML/URL to PDF or screenshot. Output lands in bound object storage as ArtifactRefs.',
	runtime: 'both',
	auth: { type: 'custom', schema: cloudflareBrowserAuthSchema },
	tools: [cloudflareBrowserRenderPdfTool, cloudflareBrowserRenderScreenshotTool]
})
