import { z } from 'zod'

/** Durable blob handle — bytes never pass through the LLM. */
export const artifactRefSchema = z.object({
	store: z
		.enum(['object', 'host'])
		.describe('Who owns the bytes. object = bound object storage; host = host-mapped key'),
	key: z.string().min(1).describe('Object key (or host id when store is host)'),
	media_type: z.string().min(1).optional().describe('MIME or format hint when known'),
	filename: z.string().min(1).optional().describe('Original or display file name'),
	byte_length: z.int().min(0).optional().describe('Size in bytes when known')
})

export type ArtifactRef = z.infer<typeof artifactRefSchema>
