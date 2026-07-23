/**
 * Gotenberg provider for the document-render seam. Wraps `GotenbergClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { GotenbergClient } from '../../../vendors/gotenberg'
import type {
	DocumentRenderOps,
	GotenbergDocumentRenderAuth,
	RenderPdfInput,
	RenderScreenshotInput
} from '../contracts'

export type GotenbergDocumentRenderProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class GotenbergDocumentRenderProvider implements DocumentRenderOps {
	readonly #client: GotenbergClient

	constructor(auth: GotenbergDocumentRenderAuth, options: GotenbergDocumentRenderProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new GotenbergClient(vendorAuth, options)
	}

	renderPdf(input: RenderPdfInput) {
		return this.#client.renderPdf(input)
	}

	renderScreenshot(input: RenderScreenshotInput) {
		return this.#client.renderScreenshot(input)
	}
}
