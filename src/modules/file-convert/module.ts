import { defineModule, defineTool } from '../../core/define'
import { FileConvertClient } from './client'
import {
	convertBatchInputSchema,
	convertBatchOutputSchema,
	convertInputSchema,
	convertOutputSchema,
	fileConvertAuthSchema
} from './contracts'

export type { FileConvertAuth } from './contracts'
export { fileConvertAuthSchema }

export const fileConvertTool = defineTool({
	id: 'file-convert',
	name: 'convertFile',
	description:
		'Convert a file ArtifactRef via the bound conversion provider. Reads from object storage, converts, writes the result back, and returns a new ArtifactRef. Source store must be object.',
	inputSchema: convertInputSchema,
	outputSchema: convertOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FileConvertClient.fromContext(ctx).convert(input)
})

export const fileConvertBatchTool = defineTool({
	id: 'file-convert-batch',
	name: 'convertFiles',
	description:
		'Convert up to 10 file ArtifactRefs. Returns per-item success or error without aborting the whole batch.',
	inputSchema: convertBatchInputSchema,
	outputSchema: convertBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FileConvertClient.fromContext(ctx).convertBatch(input)
})

export const fileConvertModule = defineModule({
	id: 'file-convert',
	title: 'File Convert',
	description: 'Convert ArtifactRef objects via the host-bound provider and write results back to object storage.',
	runtime: 'both',
	auth: { type: 'custom', schema: fileConvertAuthSchema },
	tools: [fileConvertTool, fileConvertBatchTool]
})
