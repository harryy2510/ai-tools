import path from 'node:path'

import { isString, trimStart } from 'es-toolkit'
import mime from 'mime'

/** MIME type for a path or extension, or `undefined` when unknown. */
export function mediaTypeFromPath(pathOrExtension: string): string | undefined {
	const type = mime.getType(pathOrExtension)
	return type === null ? undefined : type
}

/** Preferred file extension for a MIME type (charset stripped), or `undefined` when unknown. */
export function extensionFromMediaType(type: string): string | undefined {
	const ext = mime.getExtension(type)
	return ext === null ? undefined : ext
}

/** All known extensions for a MIME type. */
export function allExtensionsFromMediaType(type: string): readonly string[] {
	const set = mime.getAllExtensions(type)
	if (set === null) return []
	return [...set]
}

/**
 * Resolve an upload filename extension: prefer path ext, then bare format
 * (`pdf`), then `mime.getExtension(mediaType)`, else fallback.
 */
export function resolveFileExtension(options: {
	filename?: string | undefined
	mediaType?: string | undefined
	fallback?: string
}): string {
	const fallback = options.fallback ?? 'bin'
	const filename = options.filename
	if (isString(filename) && filename.length > 0) {
		const ext = path.posix.extname(filename)
		if (ext.length > 1) return trimStart(ext, '.').toLowerCase()
	}

	const mediaType = options.mediaType
	if (isString(mediaType) && mediaType.length > 0) {
		if (!mediaType.includes('/')) return mediaType.toLowerCase()
		const fromMime = extensionFromMediaType(mediaType)
		if (fromMime !== undefined) return fromMime
	}

	return fallback
}

/** Replace or append the extension of an object key (posix path semantics). */
export function deriveOutputKey(sourceKey: string, outputFormat: string, outputKey: string | undefined): string {
	if (isString(outputKey) && outputKey.length > 0) return outputKey

	const ext = trimStart(outputFormat, '.').toLowerCase()
	const dir = path.posix.dirname(sourceKey)
	const base = path.posix.basename(sourceKey, path.posix.extname(sourceKey))
	const name = `${base}.${ext}`
	return dir === '.' ? name : path.posix.join(dir, name)
}
