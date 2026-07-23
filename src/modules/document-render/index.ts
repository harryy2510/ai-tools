/**
 * Public document-render seam surface.
 * Internals (providers/*) stay private.
 */

export { DocumentRenderClient } from './client'
export {
	documentRenderAuthSchema,
	documentRenderModule,
	documentRenderPdfBatchTool,
	documentRenderPdfTool,
	documentRenderScreenshotBatchTool,
	documentRenderScreenshotTool
} from './module'
export type { DocumentRenderAuth } from './module'
export type { DocumentRenderOps, RenderOutput, RenderPdfInput, RenderScreenshotInput } from './contracts'
export {
	renderOutputSchema,
	renderPdfBatchInputSchema,
	renderPdfBatchOutputSchema,
	renderPdfInputSchema,
	renderScreenshotBatchInputSchema,
	renderScreenshotBatchOutputSchema,
	renderScreenshotInputSchema
} from './contracts'
