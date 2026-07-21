import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { artifactRefSchema } from '../../../shared/artifact'
import { createServiceFetch, serviceRequestBytes } from '../../../shared/ofetch-client'
import type { ServiceHttp } from '../../../shared/ofetch-client'
import type { DocumentRenderOps, RenderPdfInput, RenderScreenshotInput, RenderSource } from '../contracts'
import { defaultRenderKey, putRenderBytes, renderStorageAuthSchema } from '../storage'

const blockedBrowserResourceTypes = [
	'document',
	'stylesheet',
	'image',
	'media',
	'font',
	'script',
	'texttrack',
	'xhr',
	'fetch',
	'prefetch',
	'eventsource',
	'websocket',
	'manifest',
	'signedexchange',
	'ping',
	'cspviolationreport',
	'preflight',
	'other'
] as const

export const cloudflareBrowserRenderAuthSchema = z.object({
	provider: z.literal('cloudflare-browser'),
	accountId: z.string().min(1).describe('Cloudflare account id'),
	apiToken: z.string().min(1).describe('Cloudflare API token with Browser Rendering permission'),
	storage: renderStorageAuthSchema.describe('Object storage for rendered ArtifactRef output')
})

export type CloudflareBrowserRenderAuth = z.infer<typeof cloudflareBrowserRenderAuthSchema>

function readAuth(ctx: ToolContext): CloudflareBrowserRenderAuth {
	const parsed = cloudflareBrowserRenderAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('Cloudflare Browser render credentials are missing or invalid', {
			code: 'bad_auth'
		})
	}
	return parsed.data
}

function createBrowserService(auth: CloudflareBrowserRenderAuth, ctx: ToolContext): ServiceHttp {
	return createServiceFetch(
		{
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(auth.accountId)}`,
			headers: {
				Authorization: `Bearer ${auth.apiToken}`
			},
			timeout: 60_000
		},
		ctx
	)
}

function sourceBody(source: RenderSource): Record<string, unknown> {
	if (source.html !== undefined) return { html: source.html }
	if (source.url !== undefined) return { url: source.url }
	throw new ToolError('Provide html or url', { code: 'bad_input' })
}

function assertBinaryPrefix(bytes: Uint8Array, kind: 'pdf' | 'screenshot'): void {
	if (kind === 'pdf') {
		const sig = new TextEncoder().encode('%PDF-')
		const ok = bytes.byteLength >= sig.byteLength && sig.every((b, i) => bytes[i] === b)
		if (!ok) throw new ToolError('Cloudflare Browser returned non-PDF body', { code: 'upstream' })
		return
	}
	const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
	const ok = bytes.byteLength >= png.byteLength && png.every((b, i) => bytes[i] === b)
	if (!ok) throw new ToolError('Cloudflare Browser returned non-PNG body', { code: 'upstream' })
}

async function renderAndStore(
	kind: 'pdf' | 'screenshot',
	input: RenderPdfInput | RenderScreenshotInput,
	ctx: ToolContext
) {
	const auth = readAuth(ctx)
	const http = createBrowserService(auth, ctx)
	const body: Record<string, unknown> = {
		...sourceBody(input.source),
		setJavaScriptEnabled: false,
		rejectResourceTypes: [...blockedBrowserResourceTypes]
	}
	if (kind === 'pdf') {
		body['pdfOptions'] = {
			preferCSSPageSize: true,
			printBackground: true
		}
	} else {
		body['screenshotOptions'] = {
			encoding: 'binary',
			fullPage: true,
			type: 'png'
		}
		if ('viewport' in input && input.viewport !== undefined) {
			body['viewport'] = {
				width: input.viewport.width,
				height: input.viewport.height,
				...(input.viewport.device_scale_factor === undefined
					? {}
					: { deviceScaleFactor: input.viewport.device_scale_factor })
			}
		}
	}

	const path = kind === 'pdf' ? '/browser-rendering/pdf' : '/browser-rendering/screenshot'
	const accept = kind === 'pdf' ? 'application/pdf' : 'image/png'
	const { bytes } = await serviceRequestBytes(http, `Cloudflare Browser ${kind}`, path, {
		method: 'POST',
		body,
		headers: {
			'Content-Type': 'application/json',
			Accept: accept
		}
	})
	assertBinaryPrefix(bytes, kind)

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

export const cloudflareBrowserRenderProvider = defineProvider({
	id: 'cloudflare-browser',
	title: 'Cloudflare Browser Rendering',
	authSchema: cloudflareBrowserRenderAuthSchema,
	ops
})
