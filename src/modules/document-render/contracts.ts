import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'
import {
	cloudflareBrowserAuthSchema,
	cloudflareBrowserRenderOutputSchema,
	cloudflareBrowserRenderPdfInputSchema,
	cloudflareBrowserRenderScreenshotInputSchema
} from '../../vendors/cloudflare-browser'
import {
	gotenbergAuthSchema,
	gotenbergRenderOutputSchema,
	gotenbergRenderPdfInputSchema,
	gotenbergRenderScreenshotInputSchema
} from '../../vendors/gotenberg'

export const MAX_BATCH_RENDER = 10

export const gotenbergDocumentRenderAuthSchema = gotenbergAuthSchema.extend({
	provider: z.literal('gotenberg')
})

export const cloudflareBrowserDocumentRenderAuthSchema = cloudflareBrowserAuthSchema.extend({
	provider: z.literal('cloudflare-browser')
})

export type GotenbergDocumentRenderAuth = z.infer<typeof gotenbergDocumentRenderAuthSchema>
export type CloudflareBrowserDocumentRenderAuth = z.infer<typeof cloudflareBrowserDocumentRenderAuthSchema>

export const documentRenderAuthSchema = z.discriminatedUnion('provider', [
	gotenbergDocumentRenderAuthSchema,
	cloudflareBrowserDocumentRenderAuthSchema
])

export type DocumentRenderAuth = z.infer<typeof documentRenderAuthSchema>

/** Same I/O both render vendors accept (gotenberg schemas are the canonical seam shape). */
export const renderPdfInputSchema = gotenbergRenderPdfInputSchema
export const renderScreenshotInputSchema = gotenbergRenderScreenshotInputSchema
export const renderOutputSchema = gotenbergRenderOutputSchema

export const renderPdfBatchInputSchema = z.object({
	items: z.array(renderPdfInputSchema).min(1).max(MAX_BATCH_RENDER).describe('PDF render jobs (max 10)')
})

export const renderScreenshotBatchInputSchema = z.object({
	items: z.array(renderScreenshotInputSchema).min(1).max(MAX_BATCH_RENDER).describe('Screenshot jobs (max 10)')
})

export const renderPdfBatchOutputSchema = batchResultSchema(renderOutputSchema)
export const renderScreenshotBatchOutputSchema = batchResultSchema(renderOutputSchema)

export type RenderPdfInput = z.infer<typeof renderPdfInputSchema>
export type RenderScreenshotInput = z.infer<typeof renderScreenshotInputSchema>
export type RenderOutput = z.infer<typeof renderOutputSchema>
export type RenderPdfBatchInput = z.infer<typeof renderPdfBatchInputSchema>
export type RenderScreenshotBatchInput = z.infer<typeof renderScreenshotBatchInputSchema>
export type RenderPdfBatchOutput = z.infer<typeof renderPdfBatchOutputSchema>
export type RenderScreenshotBatchOutput = z.infer<typeof renderScreenshotBatchOutputSchema>

// Re-export cloudflare schemas for type identity checks if needed
export {
	cloudflareBrowserRenderPdfInputSchema,
	cloudflareBrowserRenderScreenshotInputSchema,
	cloudflareBrowserRenderOutputSchema
}

export type DocumentRenderOps = {
	renderPdf: (input: RenderPdfInput) => Promise<RenderOutput>
	renderScreenshot: (input: RenderScreenshotInput) => Promise<RenderOutput>
}
