import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { requireAuth, resolveProvider } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import {
	renderOutputSchema,
	renderPdfBatchInputSchema,
	renderPdfBatchOutputSchema,
	renderPdfInputSchema,
	renderScreenshotBatchInputSchema,
	renderScreenshotBatchOutputSchema,
	renderScreenshotInputSchema
} from './contracts'
import type { DocumentRenderOps } from './contracts'
import { cloudflareBrowserRenderAuthSchema, cloudflareBrowserRenderProvider } from './providers/cloudflare-browser'
import { gotenbergRenderAuthSchema, gotenbergRenderProvider } from './providers/gotenberg'

export const documentRenderProviders = [gotenbergRenderProvider, cloudflareBrowserRenderProvider] as const

export const documentRenderAuthSchema = z.discriminatedUnion('provider', [
	gotenbergRenderAuthSchema,
	cloudflareBrowserRenderAuthSchema
])

export type DocumentRenderAuth = z.infer<typeof documentRenderAuthSchema>

function resolveOps(ctx: ToolContext): DocumentRenderOps {
	const auth = requireAuth(ctx, documentRenderAuthSchema)
	return resolveProvider(documentRenderProviders, auth).ops
}

const documentRenderPdfTool = defineTool({
	id: 'document-render-pdf',
	name: 'renderDocumentPdf',
	description:
		'Render HTML or a URL to a PDF via the bound browser/print provider. Writes the PDF to object storage and returns an ArtifactRef. Prefer for print layouts and HTML invoices; use file-convert for office format conversion.',
	inputSchema: renderPdfInputSchema,
	outputSchema: renderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).renderPdf(input, ctx)
})

const documentRenderScreenshotTool = defineTool({
	id: 'document-render-screenshot',
	name: 'renderDocumentScreenshot',
	description:
		'Capture a PNG screenshot of HTML or a URL via the bound browser provider. Writes the image to object storage and returns an ArtifactRef.',
	inputSchema: renderScreenshotInputSchema,
	outputSchema: renderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).renderScreenshot(input, ctx)
})

const documentRenderPdfBatchTool = defineTool({
	id: 'document-render-pdf-batch',
	name: 'renderDocumentPdfBatch',
	description: 'Render up to 10 HTML/URL sources to PDF. Per-item success or error without aborting the batch.',
	inputSchema: renderPdfBatchInputSchema,
	outputSchema: renderPdfBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		return runBatchItems(input.items, async (item) => ops.renderPdf(item, ctx))
	}
})

const documentRenderScreenshotBatchTool = defineTool({
	id: 'document-render-screenshot-batch',
	name: 'renderDocumentScreenshotBatch',
	description: 'Capture up to 10 HTML/URL screenshots as PNG. Per-item success or error without aborting the batch.',
	inputSchema: renderScreenshotBatchInputSchema,
	outputSchema: renderScreenshotBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		return runBatchItems(input.items, async (item) => ops.renderScreenshot(item, ctx))
	}
})

export const documentRenderModule = defineModule({
	id: 'document-render',
	title: 'Document Render',
	description:
		'HTML/URL to PDF or screenshot via a bound provider (Gotenberg self-host or Cloudflare Browser Rendering). Distinct from file-convert (format conversion).',
	runtime: 'both',
	auth: { type: 'custom', schema: documentRenderAuthSchema },
	tools: [
		documentRenderPdfTool,
		documentRenderScreenshotTool,
		documentRenderPdfBatchTool,
		documentRenderScreenshotBatchTool
	]
})

export {
	documentRenderPdfBatchTool,
	documentRenderPdfTool,
	documentRenderScreenshotBatchTool,
	documentRenderScreenshotTool
}
