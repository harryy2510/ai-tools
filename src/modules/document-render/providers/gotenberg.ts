import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { artifactRefSchema } from '../../../shared/artifact'
import { toArrayBuffer } from '../../../shared/bytes'
import { HttpService } from '../../../transport/http-service'
import type { DocumentRenderOps, RenderPdfInput, RenderScreenshotInput, RenderSource } from '../contracts'
import { defaultRenderKey, putRenderBytes, renderStorageAuthSchema } from '../storage'

export const gotenbergRenderAuthSchema = z.object({
	provider: z.literal('gotenberg'),
	gotenberg_base_url: z.url().describe('Self-hosted Gotenberg origin, for example http://localhost:3000'),
	gotenberg_api_username: z.string().min(1).optional().describe('Optional basic-auth username'),
	gotenberg_api_password: z.string().min(1).optional().describe('Optional basic-auth password'),
	storage: renderStorageAuthSchema.describe('Object storage for rendered ArtifactRef output')
})

export type GotenbergRenderAuth = z.infer<typeof gotenbergRenderAuthSchema>

function readAuth(ctx: ToolContext): GotenbergRenderAuth {
	const parsed = gotenbergRenderAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('Gotenberg render credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function createGotenbergService(auth: GotenbergRenderAuth, ctx: ToolContext): HttpService {
	const headers: Record<string, string> = {}
	if (auth.gotenberg_api_username !== undefined && auth.gotenberg_api_password !== undefined) {
		const token = btoa(`${auth.gotenberg_api_username}:${auth.gotenberg_api_password}`)
		headers['Authorization'] = `Basic ${token}`
	}
	return new HttpService({
		baseURL: auth.gotenberg_base_url,
		headers,
		label: 'Gotenberg',
		...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch }),
		...(ctx.signal === undefined ? {} : { signal: ctx.signal })
	})
}

function appendSource(form: FormData, source: RenderSource): void {
	if (source.html !== undefined) {
		const bytes = new TextEncoder().encode(source.html)
		const blob = new Blob([toArrayBuffer(bytes)], { type: 'text/html' })
		form.append('files', blob, 'index.html')
		return
	}
	if (source.url !== undefined) {
		form.append('url', source.url)
		return
	}
	throw new ToolError('Provide html or url', { code: 'bad_input' })
}

function htmlPath(kind: 'pdf' | 'screenshot', source: RenderSource): string {
	if (source.html !== undefined) {
		return kind === 'pdf' ? '/forms/chromium/convert/html' : '/forms/chromium/screenshot/html'
	}
	return kind === 'pdf' ? '/forms/chromium/convert/url' : '/forms/chromium/screenshot/url'
}

async function renderAndStore(
	kind: 'pdf' | 'screenshot',
	input: RenderPdfInput | RenderScreenshotInput,
	ctx: ToolContext
) {
	const auth = readAuth(ctx)
	const http = createGotenbergService(auth, ctx)
	const form = new FormData()
	appendSource(form, input.source)
	if (kind === 'screenshot' && 'viewport' in input && input.viewport !== undefined) {
		form.append('width', String(input.viewport.width))
		form.append('height', String(input.viewport.height))
		if (input.viewport.device_scale_factor !== undefined) {
			form.append('deviceScaleFactor', String(input.viewport.device_scale_factor))
		}
	}

	const path = htmlPath(kind, input.source)
	const { bytes } = await http.bytes('POST', path, {
		label: `Gotenberg ${kind}`,
		body: form
	})

	const mediaType = kind === 'pdf' ? 'application/pdf' : 'image/png'
	const key = defaultRenderKey(kind, input.output_key)
	const filename = input.filename ?? (kind === 'pdf' ? 'render.pdf' : 'render.png')
	await putRenderBytes(auth.storage, key, bytes, mediaType, ctx)

	const result = artifactRefSchema.parse({
		store: 'object',
		key,
		media_type: mediaType,
		filename,
		byte_length: bytes.byteLength
	})
	return { result, kind }
}

const ops: DocumentRenderOps = {
	renderPdf: async (input, ctx) => renderAndStore('pdf', input, ctx),
	renderScreenshot: async (input, ctx) => renderAndStore('screenshot', input, ctx)
}

export const gotenbergRenderProvider = defineProvider({
	id: 'gotenberg',
	title: 'Gotenberg',
	authSchema: gotenbergRenderAuthSchema,
	ops
})
