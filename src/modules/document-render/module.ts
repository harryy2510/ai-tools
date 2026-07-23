import { defineModule, defineTool } from '../../core/define'
import { runBatchItems } from '../../shared/batch'
import { DocumentRenderClient } from './client'
import {
	documentRenderAuthSchema,
	renderOutputSchema,
	renderPdfBatchInputSchema,
	renderPdfBatchOutputSchema,
	renderPdfInputSchema,
	renderScreenshotBatchInputSchema,
	renderScreenshotBatchOutputSchema,
	renderScreenshotInputSchema
} from './contracts'

export type { DocumentRenderAuth } from './contracts'
export { documentRenderAuthSchema }

export const documentRenderPdfTool = defineTool({
	id: 'document-render-pdf',
	name: 'renderDocumentPdf',
	description:
		'Render HTML or a URL to a PDF via the bound browser/print provider. Writes the PDF to object storage and returns an ArtifactRef. Prefer for print layouts and HTML invoices; use file-convert for office format conversion.',
	inputSchema: renderPdfInputSchema,
	outputSchema: renderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => DocumentRenderClient.fromContext(ctx).renderPdf(input)
})

export const documentRenderScreenshotTool = defineTool({
	id: 'document-render-screenshot',
	name: 'renderDocumentScreenshot',
	description:
		'Capture a PNG screenshot of HTML or a URL via the bound browser provider. Writes the image to object storage and returns an ArtifactRef.',
	inputSchema: renderScreenshotInputSchema,
	outputSchema: renderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => DocumentRenderClient.fromContext(ctx).renderScreenshot(input)
})

export const documentRenderPdfBatchTool = defineTool({
	id: 'document-render-pdf-batch',
	name: 'renderDocumentPdfBatch',
	description: 'Render up to 10 HTML/URL sources to PDF. Per-item success or error without aborting the batch.',
	inputSchema: renderPdfBatchInputSchema,
	outputSchema: renderPdfBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const client = DocumentRenderClient.fromContext(ctx)
		return runBatchItems(input.items, async (item) => client.renderPdf(item))
	}
})

export const documentRenderScreenshotBatchTool = defineTool({
	id: 'document-render-screenshot-batch',
	name: 'renderDocumentScreenshotBatch',
	description: 'Capture up to 10 HTML/URL screenshots as PNG. Per-item success or error without aborting the batch.',
	inputSchema: renderScreenshotBatchInputSchema,
	outputSchema: renderScreenshotBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const client = DocumentRenderClient.fromContext(ctx)
		return runBatchItems(input.items, async (item) => client.renderScreenshot(item))
	}
})

export const documentRenderModule = defineModule({
	id: 'document-render',
	title: 'Document Render',
	description:
		'HTML/URL to PDF or screenshot via the host-bound provider. Distinct from file-convert (format conversion).',
	runtime: 'both',
	auth: { type: 'custom', schema: documentRenderAuthSchema },
	tools: [
		documentRenderPdfTool,
		documentRenderScreenshotTool,
		documentRenderPdfBatchTool,
		documentRenderScreenshotBatchTool
	]
})
