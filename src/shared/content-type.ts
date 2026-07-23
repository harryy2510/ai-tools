import { isString, trimStart } from 'es-toolkit'
import mime from 'mime'

/** Last path segment after `/`. */
function baseName(key: string): string {
	const i = key.lastIndexOf('/')
	return i === -1 ? key : key.slice(i + 1)
}

/** Extension including leading `.` (empty if none). Posix object-key semantics. */
function extName(key: string): string {
	const base = baseName(key)
	const i = base.lastIndexOf('.')
	return i > 0 ? base.slice(i) : ''
}

/** MIME type for a path or extension, or `undefined` when unknown. */
export function mediaTypeFromPath(pathOrExtension: string): string | undefined {
	return mime.getType(pathOrExtension) ?? undefined
}

/** Preferred file extension for a MIME type (charset stripped), or `undefined` when unknown. */
export function extensionFromMediaType(type: string): string | undefined {
	return mime.getExtension(type) ?? undefined
}

/** All known extensions for a MIME type. */
export function allExtensionsFromMediaType(type: string): readonly string[] {
	const set = mime.getAllExtensions(type)
	return [...(set ?? [])]
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
		const ext = extName(filename)
		if (ext.length > 1) return trimStart(ext, '.').toLowerCase()
	}

	const mediaType = options.mediaType
	if (isString(mediaType) && mediaType.length > 0) {
		if (!mediaType.includes('/')) return mediaType.toLowerCase()
		const fromMime = extensionFromMediaType(mediaType)
		if (fromMime) return fromMime
	}

	return fallback
}

/** Replace or append the extension of an object key (posix path semantics). */
export function deriveOutputKey(sourceKey: string, outputFormat: string, outputKey: string | undefined): string {
	if (isString(outputKey) && outputKey.length > 0) return outputKey

	const ext = trimStart(outputFormat, '.').toLowerCase()
	const slash = sourceKey.lastIndexOf('/')
	const dir = slash === -1 ? '' : sourceKey.slice(0, slash + 1)
	const stem = baseName(sourceKey)
	const stemExt = extName(stem)
	const base = stemExt.length > 0 ? stem.slice(0, -stemExt.length) : stem
	return `${dir}${base}.${ext}`
}
