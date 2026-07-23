/**
 * Cloudflare Browser provider for the document-render seam. Wraps `CloudflareBrowserClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { CloudflareBrowserClient } from '../../../vendors/cloudflare-browser'
import type {
	CloudflareBrowserDocumentRenderAuth,
	DocumentRenderOps,
	RenderPdfInput,
	RenderScreenshotInput
} from '../contracts'

export type CloudflareBrowserDocumentRenderProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareBrowserDocumentRenderProvider implements DocumentRenderOps {
	readonly #client: CloudflareBrowserClient

	constructor(auth: CloudflareBrowserDocumentRenderAuth, options: CloudflareBrowserDocumentRenderProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new CloudflareBrowserClient(vendorAuth, options)
	}

	renderPdf(input: RenderPdfInput) {
		return this.#client.renderPdf(input)
	}

	renderScreenshot(input: RenderScreenshotInput) {
		return this.#client.renderScreenshot(input)
	}
}
