import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { allExtensionsFromMediaType, extensionFromMediaType, mediaTypeFromPath } from '../../shared/media-type'

const getTypeInput = z.object({
	path: z
		.string()
		.min(1)
		.describe('File path, filename, or extension (with or without leading dot), for example report.pdf or pdf')
})

const getTypeOutput = z.object({
	media_type: z.string().nullable().describe('MIME type, or null when unrecognized')
})

const getExtensionInput = z.object({
	media_type: z.string().min(1).describe('MIME type; optional charset is ignored, for example text/html; charset=utf-8')
})

const getExtensionOutput = z.object({
	extension: z.string().nullable().describe('Preferred file extension without a leading dot, or null')
})

const getAllExtensionsOutput = z.object({
	extensions: z.array(z.string()).describe('All known extensions for the type (may be empty)')
})

export const mediaTypeGetTool = defineTool({
	id: 'media-type-get',
	name: 'getMediaType',
	description:
		'Look up the MIME type for a file path, filename, or extension using the mime package (mime-db). Returns null when the extension is unknown.',
	inputSchema: getTypeInput,
	outputSchema: getTypeOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		const mediaType = mediaTypeFromPath(input.path)
		return getTypeOutput.parse({ media_type: mediaType ?? null })
	}
})

export const mediaTypeExtensionTool = defineTool({
	id: 'media-type-extension',
	name: 'getMediaExtension',
	description:
		'Look up the preferred file extension for a MIME type using the mime package. Charset parameters are ignored. Returns null when unknown.',
	inputSchema: getExtensionInput,
	outputSchema: getExtensionOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		const extension = extensionFromMediaType(input.media_type)
		return getExtensionOutput.parse({ extension: extension ?? null })
	}
})

export const mediaTypeExtensionsTool = defineTool({
	id: 'media-type-extensions',
	name: 'getMediaExtensions',
	description:
		'List all known file extensions for a MIME type (for example image/jpeg → jpeg, jpg, jpe). Empty when unknown.',
	inputSchema: getExtensionInput,
	outputSchema: getAllExtensionsOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		return getAllExtensionsOutput.parse({
			extensions: [...allExtensionsFromMediaType(input.media_type)]
		})
	}
})

export const mediaTypeModule = defineModule({
	id: 'media-type',
	title: 'Media Type',
	description:
		'MIME type ↔ extension lookup via the mime package (mime-db). Distinct from the email MIME parse/build module.',
	runtime: 'both',
	auth: { type: 'none' },
	tools: [mediaTypeGetTool, mediaTypeExtensionTool, mediaTypeExtensionsTool]
})
