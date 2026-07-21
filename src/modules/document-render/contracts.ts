import { z } from 'zod'

import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import { batchResultSchema } from '../../shared/batch'

export const MAX_BATCH_RENDER = 10
export const MAX_HTML_CHARS = 2_000_000

export const viewportSchema = z.object({
	width: z.int().min(1).max(8_000).describe('Viewport width in CSS pixels'),
	height: z.int().min(1).max(8_000).describe('Viewport height in CSS pixels'),
	device_scale_factor: z.number().min(0.1).max(4).optional().describe('Device scale factor (default 1)')
})

export const renderSourceSchema = z
	.object({
		html: z.string().min(1).max(MAX_HTML_CHARS).optional().describe('HTML document body to render'),
		url: z.url().optional().describe('Absolute http(s) URL to open and render')
	})
	.refine((v) => Boolean(v.html?.trim() || v.url), {
		message: 'Provide html or url'
	})
	.refine((v) => !(v.html !== undefined && v.url !== undefined), {
		message: 'Provide only one of html or url'
	})

export const renderPdfInputSchema = z.object({
	source: renderSourceSchema.describe('HTML string or URL to print'),
	output_key: z.string().min(1).optional().describe('Object key for the PDF. Defaults under renders/'),
	filename: z.string().min(1).optional().describe('Display filename for the result ArtifactRef')
})

export const renderScreenshotInputSchema = z.object({
	source: renderSourceSchema.describe('HTML string or URL to capture'),
	output_key: z.string().min(1).optional().describe('Object key for the PNG. Defaults under renders/'),
	filename: z.string().min(1).optional().describe('Display filename for the result ArtifactRef'),
	viewport: viewportSchema.optional().describe('Optional screenshot viewport')
})

export const renderOutputSchema = z.object({
	result: artifactRefSchema,
	kind: z.enum(['pdf', 'screenshot'])
})

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
export type RenderSource = z.infer<typeof renderSourceSchema>
export type Viewport = z.infer<typeof viewportSchema>

export type DocumentRenderOps = {
	renderPdf: (input: RenderPdfInput, ctx: ToolContext) => Promise<RenderOutput>
	renderScreenshot: (input: RenderScreenshotInput, ctx: ToolContext) => Promise<RenderOutput>
}
