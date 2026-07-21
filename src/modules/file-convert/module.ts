import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { requireAuth, resolveProvider } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import { convertBatchInputSchema, convertBatchOutputSchema, convertInputSchema, convertOutputSchema } from './contracts'
import type { FileConvertOps } from './contracts'
import { transmuteConvertAuthSchema, transmuteConvertProvider } from './providers/transmute'

export const fileConvertProviders = [transmuteConvertProvider] as const

export const fileConvertAuthSchema = z.discriminatedUnion('provider', [transmuteConvertAuthSchema])

export type FileConvertAuth = z.infer<typeof fileConvertAuthSchema>

function resolveOps(ctx: ToolContext): FileConvertOps {
	const auth = requireAuth(ctx, fileConvertAuthSchema)
	return resolveProvider(fileConvertProviders, auth).ops
}

const fileConvertTool = defineTool({
	id: 'file-convert',
	name: 'convertFile',
	description:
		'Convert a file ArtifactRef via the bound conversion provider. Reads from object storage, converts, writes the result back, and returns a new ArtifactRef. Source store must be object.',
	inputSchema: convertInputSchema,
	outputSchema: convertOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => resolveOps(ctx).convert(input, ctx)
})

const fileConvertBatchTool = defineTool({
	id: 'file-convert-batch',
	name: 'convertFiles',
	description:
		'Convert up to 10 file ArtifactRefs. Returns per-item success or error without aborting the whole batch.',
	inputSchema: convertBatchInputSchema,
	outputSchema: convertBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const ops = resolveOps(ctx)
		if (ops.convertBatch !== undefined) {
			return ops.convertBatch(input, ctx)
		}
		return runBatchItems(input.items, async (item) => ops.convert(item, ctx))
	}
})

export const fileConvertModule = defineModule({
	id: 'file-convert',
	title: 'File Convert',
	description:
		'Convert ArtifactRef objects via a bound provider (Transmute or future providers) and write results back to object storage.',
	runtime: 'both',
	auth: { type: 'custom', schema: fileConvertAuthSchema },
	tools: [fileConvertTool, fileConvertBatchTool]
})

export { fileConvertBatchTool, fileConvertTool }
