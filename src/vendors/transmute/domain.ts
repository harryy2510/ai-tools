/**
 * Transmute upload/conversion payload helpers (no HTTP).
 */

import { isPlainObject, isString, trimStart } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { deriveOutputKey, mediaTypeFromPath, resolveFileExtension } from '../../shared/content-type'
import type { TransmuteConvertInput } from './contracts'

export function resolveUploadFilename(input: TransmuteConvertInput): {
	filename: string
	uploadMediaType: string
	ext: string
} {
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
	return { filename, uploadMediaType, ext }
}

export function parseUploadFileId(data: unknown): string {
	if (!isPlainObject(data) || !isPlainObject(data['metadata'])) {
		throw new ToolError('Convert upload returned unexpected payload', { code: 'upstream' })
	}
	const meta = data['metadata']
	const sourceId = meta['id']
	if (!isString(sourceId) || sourceId.length === 0) {
		throw new ToolError('Convert upload missing file id', { code: 'upstream' })
	}
	return sourceId
}

export function parseConversionMeta(data: unknown): {
	resultId: string
	mediaType?: string
	originalFilename?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Conversion returned unexpected payload', { code: 'upstream' })
	}
	const resultId = data['id']
	if (!isString(resultId) || resultId.length === 0) {
		throw new ToolError('Conversion missing result id', { code: 'upstream' })
	}
	const mediaTypeRaw = data['media_type']
	const mediaType =
		isString(mediaTypeRaw) && mediaTypeRaw.length > 0 && mediaTypeRaw.includes('/') ? mediaTypeRaw : undefined
	const nameRaw = data['original_filename']
	const originalFilename = isString(nameRaw) && nameRaw.length > 0 ? nameRaw : undefined
	return {
		resultId,
		...(mediaType && { mediaType }),
		...(originalFilename && { originalFilename })
	}
}

export function normalizeOutputFormat(outputFormat: string): string {
	return trimStart(outputFormat, '.').toLowerCase()
}

export function resolveResultKey(sourceKey: string, outputFormat: string, outputKey: string | undefined): string {
	return deriveOutputKey(sourceKey, outputFormat, outputKey)
}

export function resolveResultMediaType(convertedMediaType: string | undefined, outputFormat: string): string {
	return convertedMediaType ?? mediaTypeFromPath(outputFormat) ?? outputFormat
}

export function resolveResultFilename(
	convertedFilename: string | undefined,
	uploadFilename: string,
	outputFormat: string
): string {
	if (convertedFilename) return convertedFilename
	return deriveOutputKey(uploadFilename, outputFormat, undefined)
}
