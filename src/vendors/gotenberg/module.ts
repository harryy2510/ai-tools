import { defineModule, defineTool } from '../../core/define'
import { GotenbergClient } from './client'
import {
	gotenbergAuthSchema,
	gotenbergRenderOutputSchema,
	gotenbergRenderPdfInputSchema,
	gotenbergRenderScreenshotInputSchema
} from './contracts'

export const gotenbergRenderPdfTool = defineTool({
	id: 'gotenberg-render-pdf',
	name: 'gotenbergRenderPdf',
	description:
		'Render HTML or a URL to a PDF via Gotenberg Chromium. Writes the PDF to object storage and returns an ArtifactRef.',
	inputSchema: gotenbergRenderPdfInputSchema,
	outputSchema: gotenbergRenderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => GotenbergClient.fromContext(ctx).renderPdf(input)
})

export const gotenbergRenderScreenshotTool = defineTool({
	id: 'gotenberg-render-screenshot',
	name: 'gotenbergRenderScreenshot',
	description:
		'Capture a PNG screenshot of HTML or a URL via Gotenberg Chromium. Writes the image to object storage and returns an ArtifactRef.',
	inputSchema: gotenbergRenderScreenshotInputSchema,
	outputSchema: gotenbergRenderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => GotenbergClient.fromContext(ctx).renderScreenshot(input)
})

export const gotenbergModule = defineModule({
	id: 'gotenberg',
	title: 'Gotenberg',
	description:
		'Gotenberg vendor pack: HTML/URL to PDF or screenshot via self-hosted Chromium. Output lands in bound object storage as ArtifactRefs.',
	runtime: 'both',
	auth: { type: 'custom', schema: gotenbergAuthSchema },
	tools: [gotenbergRenderPdfTool, gotenbergRenderScreenshotTool]
})
