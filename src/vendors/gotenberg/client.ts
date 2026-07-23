/**
 * Gotenberg vendor client (HTML/URL → PDF or screenshot).
 * Host: `new GotenbergClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { S3Client } from '../s3'
import type {
	GotenbergAuth,
	GotenbergRenderOutput,
	GotenbergRenderPdfInput,
	GotenbergRenderScreenshotInput
} from './contracts'
import { gotenbergAuthSchema, gotenbergRenderOutputSchema } from './contracts'
import { appendSource, defaultRenderKey, htmlPath } from './domain'

export type GotenbergClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class GotenbergClient {
	readonly #auth: GotenbergAuth
	readonly #http: HttpService
	readonly #storage: S3Client

	constructor(auth: GotenbergAuth, options: GotenbergClientOptions = {}) {
		const parsed = gotenbergAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Gotenberg auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		const headers: Record<string, string> = {}
		if (this.#auth.gotenberg_api_username && this.#auth.gotenberg_api_password) {
			const token = btoa(`${this.#auth.gotenberg_api_username}:${this.#auth.gotenberg_api_password}`)
			headers['Authorization'] = `Basic ${token}`
		}
		this.#http = new HttpService({
			...options,
			baseURL: this.#auth.gotenberg_base_url,
			headers,
			label: 'Gotenberg'
		})
		this.#storage = new S3Client(this.#auth.storage, options)
	}

	static fromContext(ctx: ToolContext): GotenbergClient {
		const auth = requireAuth(ctx, gotenbergAuthSchema)
		return new GotenbergClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** Chromium HTML/URL → PDF; store result in object storage. */
	async renderPdf(input: GotenbergRenderPdfInput): Promise<GotenbergRenderOutput> {
		return this.#renderAndStore('pdf', input)
	}

	/** Chromium HTML/URL → PNG screenshot; store result in object storage. */
	async renderScreenshot(input: GotenbergRenderScreenshotInput): Promise<GotenbergRenderOutput> {
		return this.#renderAndStore('screenshot', input)
	}

	async #renderAndStore(
		kind: 'pdf' | 'screenshot',
		input: GotenbergRenderPdfInput | GotenbergRenderScreenshotInput
	): Promise<GotenbergRenderOutput> {
		const form = new FormData()
		appendSource(form, input.source)
		if (kind === 'screenshot' && 'viewport' in input && input.viewport) {
			form.append('width', String(input.viewport.width))
			form.append('height', String(input.viewport.height))
			if (input.viewport.device_scale_factor !== undefined) {
				form.append('deviceScaleFactor', String(input.viewport.device_scale_factor))
			}
		}

		const path = htmlPath(kind, input.source)
		const { bytes } = await this.#http.bytes('POST', path, {
			label: `Gotenberg ${kind}`,
			body: form
		})

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
		return gotenbergRenderOutputSchema.parse({ result, kind })
	}
}
