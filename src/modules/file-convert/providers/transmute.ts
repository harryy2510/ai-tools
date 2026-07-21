import { isPlainObject, isString, trimStart } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { runBatchItems } from '../../../shared/batch'
import { artifactRefSchema } from '../../../shared/artifact'
import { deriveOutputKey, mediaTypeFromPath, resolveFileExtension } from '../../../shared/media-type'
import { createServiceFetch, serviceRequestBytes, serviceRequestJson } from '../../../shared/ofetch-client'
import type { ServiceHttp } from '../../../shared/ofetch-client'
import { s3StorageAuthSchema, s3StorageProvider } from '../../storage/providers/s3'
import type { ConvertInput, ConvertOutput, FileConvertOps } from '../contracts'
import { convertOutputSchema } from '../contracts'

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

function createTransmuteService(auth: TransmuteConvertAuth, ctx: ToolContext) {
	const http: ServiceHttp = createServiceFetch(
		{
			baseURL: auth.transmute_base_url,
			headers: {
				Authorization: `Bearer ${auth.transmute_token}`
			}
		},
		ctx
	)
	return {
		upload: (form: FormData) =>
			serviceRequestJson(http, 'Transmute upload', '/api/files', {
				method: 'POST',
				body: form
			}),
		convert: (body: Record<string, unknown>) =>
			serviceRequestJson(http, 'Transmute convert', '/api/conversions', {
				method: 'POST',
				body,
				headers: { 'Content-Type': 'application/json' }
			}),
		download: (fileId: string) =>
			serviceRequestBytes(http, 'Transmute download', `/api/files/${encodeURIComponent(fileId)}`)
	}
}

async function convertOne(input: ConvertInput, ctx: ToolContext): Promise<ConvertOutput> {
	const auth = readAuth(ctx)
	if (input.source.store !== 'object') {
		throw new ToolError('file-convert requires source.store "object"', { code: 'bad_input' })
	}

	const bytes = await s3StorageProvider.ops.getBytes(input.source.key, { ...ctx, auth: auth.storage })
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

	const svc = createTransmuteService(auth, ctx)
	const form = new FormData()
	const uploadBuffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(uploadBuffer).set(bytes)
	const blob = new Blob([uploadBuffer], { type: uploadMediaType })
	form.append('file', blob, filename)

	const upload = await svc.upload(form)
	const uploadJson = upload.data
	if (!isPlainObject(uploadJson) || !isPlainObject(uploadJson['metadata'])) {
		throw new ToolError('Convert upload returned unexpected payload', { code: 'upstream' })
	}
	const meta = uploadJson['metadata']
	const sourceId = meta['id']
	if (!isString(sourceId) || sourceId.length === 0) {
		throw new ToolError('Convert upload missing file id', { code: 'upstream' })
	}

	const outputFormat = trimStart(input.output_format, '.').toLowerCase()
	const conv = await svc.convert({
		id: sourceId,
		output_format: outputFormat,
		...(input.quality === undefined ? {} : { quality: input.quality })
	})
	const convertedMeta = conv.data
	if (!isPlainObject(convertedMeta)) {
		throw new ToolError('Conversion returned unexpected payload', { code: 'upstream' })
	}
	const resultId = convertedMeta['id']
	if (!isString(resultId) || resultId.length === 0) {
		throw new ToolError('Conversion missing result id', { code: 'upstream' })
	}

	const { bytes: outBytes } = await svc.download(resultId)

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

	await s3StorageProvider.ops.putBytes(resultKey, outBytes, undefined, { ...ctx, auth: auth.storage })

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
