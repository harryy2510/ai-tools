import { createFetch, FetchError } from 'ofetch'
import { isPlainObject, isString, trimStart } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { runBatchItems } from '../../../shared/batch'
import { artifactRefSchema } from '../../../shared/artifact'
import { deriveOutputKey, mediaTypeFromPath, resolveFileExtension } from '../../../shared/media-type'
import { s3StorageAuthSchema, s3StorageProvider } from '../../storage/providers/s3'
import type { ConvertInput, ConvertOutput, FileConvertOps } from '../contracts'
import { convertOutputSchema } from '../contracts'

/** Nested object-store credentials for reading/writing ArtifactRefs (host-only). */
const storageAuthSchema = s3StorageAuthSchema

export const transmuteConvertAuthSchema = z.object({
	provider: z.literal('transmute'),
	transmute_base_url: z.url().describe('Self-hosted Transmute origin, for example http://localhost:3313'),
	transmute_token: z.string().min(1).describe('Transmute Bearer token (API key or JWT)'),
	storage: storageAuthSchema.describe('Object storage credentials for artifact IO')
})

export type TransmuteConvertAuth = z.infer<typeof transmuteConvertAuthSchema>

function readAuth(ctx: ToolContext): TransmuteConvertAuth {
	const parsed = transmuteConvertAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('File convert credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function client(auth: TransmuteConvertAuth, ctx: ToolContext) {
	return createFetch({
		defaults: {
			baseURL: auth.transmute_base_url.replace(/\/+$/, ''),
			headers: {
				Authorization: `Bearer ${auth.transmute_token}`
			},
			retry: false,
			ignoreResponseError: true,
			...(ctx.signal === undefined ? {} : { signal: ctx.signal })
		}
	})
}

function mapFetchError(error: unknown): never {
	if (error instanceof ToolError) throw error
	if (error instanceof FetchError) {
		throw new ToolError(error.message || 'Convert request failed', {
			code: 'upstream',
			retryable: true,
			cause: error
		})
	}
	throw new ToolError('Convert request failed', { code: 'upstream', retryable: true, cause: error })
}

async function getBytes(auth: z.infer<typeof storageAuthSchema>, key: string, ctx: ToolContext): Promise<Uint8Array> {
	return s3StorageProvider.ops.getBytes(key, { ...ctx, auth })
}

async function putBytes(
	auth: z.infer<typeof storageAuthSchema>,
	key: string,
	bytes: Uint8Array,
	contentType: string | undefined,
	ctx: ToolContext
): Promise<void> {
	return s3StorageProvider.ops.putBytes(key, bytes, contentType, { ...ctx, auth })
}

async function convertOne(input: ConvertInput, ctx: ToolContext): Promise<ConvertOutput> {
	const auth = readAuth(ctx)
	if (input.source.store !== 'object') {
		throw new ToolError('file-convert requires source.store "object"', { code: 'bad_input' })
	}

	const bytes = await getBytes(auth.storage, input.source.key, ctx)
	const ext = resolveFileExtension({
		filename: input.filename ?? input.source.filename,
		mediaType: input.source.media_type,
		fallback: 'bin'
	})
	const filename = input.filename ?? input.source.filename ?? `upload.${ext}`
	const uploadMediaType =
		(isString(input.source.media_type) && input.source.media_type.includes('/')
			? input.source.media_type
			: undefined) ??
		mediaTypeFromPath(filename) ??
		mediaTypeFromPath(ext) ??
		'application/octet-stream'

	const $fetch = client(auth, ctx)
	const form = new FormData()
	const uploadBuffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(uploadBuffer).set(bytes)
	const blob = new Blob([uploadBuffer], { type: uploadMediaType })
	form.append('file', blob, filename)

	let uploadJson: unknown
	try {
		const uploadRes = await $fetch.raw('/api/files', {
			method: 'POST',
			body: form
		})
		if (!uploadRes.ok) {
			throw new ToolError(`Convert upload failed with HTTP ${uploadRes.status}`, {
				code: 'upstream',
				details: { status: uploadRes.status }
			})
		}
		uploadJson = uploadRes._data
	} catch (error) {
		mapFetchError(error)
	}

	if (!isPlainObject(uploadJson) || !isPlainObject(uploadJson['metadata'])) {
		throw new ToolError('Convert upload returned unexpected payload', { code: 'upstream' })
	}
	const meta = uploadJson['metadata']
	const sourceId = meta['id']
	if (!isString(sourceId) || sourceId.length === 0) {
		throw new ToolError('Convert upload missing file id', { code: 'upstream' })
	}

	const outputFormat = trimStart(input.output_format, '.').toLowerCase()
	let convertedMeta: unknown
	try {
		const convRes = await $fetch.raw('/api/conversions', {
			method: 'POST',
			body: {
				id: sourceId,
				output_format: outputFormat,
				...(input.quality === undefined ? {} : { quality: input.quality })
			},
			headers: { 'Content-Type': 'application/json' }
		})
		if (!convRes.ok) {
			const detail =
				isPlainObject(convRes._data) && isString(convRes._data['detail'])
					? convRes._data['detail']
					: `Conversion failed with HTTP ${convRes.status}`
			throw new ToolError(detail, {
				code: 'upstream',
				details: { status: convRes.status }
			})
		}
		convertedMeta = convRes._data
	} catch (error) {
		mapFetchError(error)
	}

	if (!isPlainObject(convertedMeta)) {
		throw new ToolError('Conversion returned unexpected payload', { code: 'upstream' })
	}
	const resultId = convertedMeta['id']
	if (!isString(resultId) || resultId.length === 0) {
		throw new ToolError('Conversion missing result id', { code: 'upstream' })
	}

	let outBytes = new Uint8Array(0)
	try {
		const dl = await $fetch.raw(`/api/files/${encodeURIComponent(resultId)}`, {
			method: 'GET',
			responseType: 'arrayBuffer'
		})
		if (!dl.ok) {
			throw new ToolError(`Convert download failed with HTTP ${dl.status}`, {
				code: 'upstream',
				details: { status: dl.status }
			})
		}
		const data: unknown = dl._data
		let raw: Uint8Array | undefined
		if (data instanceof ArrayBuffer) {
			raw = new Uint8Array(data)
		} else if (ArrayBuffer.isView(data)) {
			raw = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
		}
		if (raw === undefined) {
			throw new ToolError('Convert download returned non-binary body', { code: 'upstream' })
		}
		const copy = new ArrayBuffer(raw.byteLength)
		outBytes = new Uint8Array(copy)
		outBytes.set(raw)
	} catch (error) {
		mapFetchError(error)
	}

	const resultKey = deriveOutputKey(input.source.key, outputFormat, input.output_key)
	const resultMedia =
		(isString(convertedMeta['media_type']) &&
		convertedMeta['media_type'].length > 0 &&
		convertedMeta['media_type'].includes('/')
			? convertedMeta['media_type']
			: undefined) ??
		mediaTypeFromPath(outputFormat) ??
		outputFormat
	const resultName =
		isString(convertedMeta['original_filename']) && convertedMeta['original_filename'].length > 0
			? convertedMeta['original_filename']
			: deriveOutputKey(filename, outputFormat, undefined)

	await putBytes(auth.storage, resultKey, outBytes, undefined, ctx)

	const result = artifactRefSchema.parse({
		store: 'object',
		key: resultKey,
		media_type: resultMedia,
		filename: resultName,
		byte_length: outBytes.byteLength
	})

	return convertOutputSchema.parse({
		source: input.source,
		result,
		provider_source_id: sourceId,
		provider_result_id: resultId
	})
}

const ops: FileConvertOps = {
	convert: convertOne,
	convertBatch: async (input, ctx) => runBatchItems(input.items, async (item) => convertOne(item, ctx))
}

export const transmuteConvertProvider = defineProvider({
	id: 'transmute',
	title: 'Transmute',
	authSchema: transmuteConvertAuthSchema,
	ops
})
