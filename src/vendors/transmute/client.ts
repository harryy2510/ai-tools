/**
 * Transmute vendor client (object-store file conversion).
 * Host: `new TransmuteClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import { runBatchItems } from '../../shared/batch'
import { toArrayBuffer } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { S3Client } from '../s3'
import type {
	TransmuteAuth,
	TransmuteConvertBatchInput,
	TransmuteConvertBatchOutput,
	TransmuteConvertInput,
	TransmuteConvertOutput
} from './contracts'
import { transmuteAuthSchema, transmuteConvertOutputSchema } from './contracts'
import {
	normalizeOutputFormat,
	parseConversionMeta,
	parseUploadFileId,
	resolveResultFilename,
	resolveResultKey,
	resolveResultMediaType,
	resolveUploadFilename
} from './domain'

export type TransmuteClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TransmuteClient {
	readonly #auth: TransmuteAuth
	readonly #http: HttpService
	readonly #storage: S3Client

	constructor(auth: TransmuteAuth, options: TransmuteClientOptions = {}) {
		const parsed = transmuteAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Transmute auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#http = new HttpService({
			...options,
			baseURL: this.#auth.transmute_base_url,
			headers: {
				Authorization: `Bearer ${this.#auth.transmute_token}`
			},
			label: 'Transmute'
		})
		this.#storage = new S3Client(this.#auth.storage, options)
	}

	static fromContext(ctx: ToolContext): TransmuteClient {
		const auth = requireAuth(ctx, transmuteAuthSchema)
		return new TransmuteClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** Download source from object storage → Transmute convert → put result. */
	async convert(input: TransmuteConvertInput): Promise<TransmuteConvertOutput> {
		if (input.source.store !== 'object') {
			throw new ToolError('Transmute convert requires source.store "object"', { code: 'bad_input' })
		}

		const bytes = await this.#storage.getBytes(input.source.key)
		const { filename, uploadMediaType } = resolveUploadFilename(input)

		const form = new FormData()
		const blob = new Blob([toArrayBuffer(bytes)], { type: uploadMediaType })
		form.append('file', blob, filename)

		const upload = await this.#http.post('/api/files', form, { label: 'Transmute upload' })
		const sourceId = parseUploadFileId(upload.data)

		const outputFormat = normalizeOutputFormat(input.output_format)
		const conv = await this.#http.post(
			'/api/conversions',
			{
				id: sourceId,
				output_format: outputFormat,
				quality: input.quality
			},
			{
				label: 'Transmute convert',
				headers: { 'Content-Type': 'application/json' }
			}
		)
		const converted = parseConversionMeta(conv.data)

		const { bytes: outBytes } = await this.#http.bytes('GET', `/api/files/${encodeURIComponent(converted.resultId)}`, {
			label: 'Transmute download'
		})

		const resultKey = resolveResultKey(input.source.key, outputFormat, input.output_key)
		const resultMedia = resolveResultMediaType(converted.mediaType, outputFormat)
		const resultName = resolveResultFilename(converted.originalFilename, filename, outputFormat)

		await this.#storage.putBytes(resultKey, outBytes)

		const result = artifactRefSchema.parse({
			store: 'object',
			key: resultKey,
			media_type: resultMedia,
			filename: resultName,
			byte_length: outBytes.byteLength
		})

		return transmuteConvertOutputSchema.parse({
			source: input.source,
			result,
			provider_source_id: sourceId,
			provider_result_id: converted.resultId
		})
	}

	/** Sequential batch of independent conversions (partial failure OK). */
	async convertBatch(input: TransmuteConvertBatchInput): Promise<TransmuteConvertBatchOutput> {
		return runBatchItems(input.items, (item) => this.convert(item))
	}
}
