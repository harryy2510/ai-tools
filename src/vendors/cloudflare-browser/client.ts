/**
 * Cloudflare Browser Rendering vendor client (HTML/URL → PDF or screenshot).
 * Host: `new CloudflareBrowserClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { S3Client } from '../s3'
import type {
	CloudflareBrowserAuth,
	CloudflareBrowserRenderOutput,
	CloudflareBrowserRenderPdfInput,
	CloudflareBrowserRenderScreenshotInput
} from './contracts'
import { cloudflareBrowserAuthSchema, cloudflareBrowserRenderOutputSchema } from './contracts'
import { assertBinaryPrefix, blockedBrowserResourceTypes, defaultRenderKey, sourceBody } from './domain'

export type CloudflareBrowserClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareBrowserClient {
	readonly #auth: CloudflareBrowserAuth
	readonly #http: HttpService
	readonly #storage: S3Client

	constructor(auth: CloudflareBrowserAuth, options: CloudflareBrowserClientOptions = {}) {
		const parsed = cloudflareBrowserAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Cloudflare Browser auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#http = new HttpService({
			...options,
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.#auth.account_id)}`,
			headers: {
				Authorization: `Bearer ${this.#auth.api_token}`
			},
			timeout: 60_000,
			label: 'Cloudflare Browser'
		})
		this.#storage = new S3Client(this.#auth.storage, options)
	}

	static fromContext(ctx: ToolContext): CloudflareBrowserClient {
		const auth = requireAuth(ctx, cloudflareBrowserAuthSchema)
		return new CloudflareBrowserClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** Browser Rendering PDF; store result in object storage. */
	async renderPdf(input: CloudflareBrowserRenderPdfInput): Promise<CloudflareBrowserRenderOutput> {
		return this.#renderAndStore('pdf', input)
	}

	/** Browser Rendering screenshot (PNG); store result in object storage. */
	async renderScreenshot(input: CloudflareBrowserRenderScreenshotInput): Promise<CloudflareBrowserRenderOutput> {
		return this.#renderAndStore('screenshot', input)
	}

	async #renderAndStore(
		kind: 'pdf' | 'screenshot',
		input: CloudflareBrowserRenderPdfInput | CloudflareBrowserRenderScreenshotInput
	): Promise<CloudflareBrowserRenderOutput> {
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
			if ('viewport' in input && input.viewport) {
				const viewport: Record<string, unknown> = {
					width: input.viewport.width,
					height: input.viewport.height
				}
				if (input.viewport.device_scale_factor !== undefined) {
					viewport['deviceScaleFactor'] = input.viewport.device_scale_factor
				}
				body['viewport'] = viewport
			}
		}

		const path = kind === 'pdf' ? '/browser-rendering/pdf' : '/browser-rendering/screenshot'
		const accept = kind === 'pdf' ? 'application/pdf' : 'image/png'
		const { bytes } = await this.#http.bytes('POST', path, {
			label: `Cloudflare Browser ${kind}`,
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
		await this.#storage.putBytes(key, bytes, mediaType)

		const result = artifactRefSchema.parse({
			store: 'object',
			key,
			media_type: mediaType,
			filename,
			byte_length: bytes.byteLength
		})
		return cloudflareBrowserRenderOutputSchema.parse({ result, kind })
	}
}
