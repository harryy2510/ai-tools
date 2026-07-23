import { defineModule, defineTool } from '../../core/define'
import { TransmuteClient } from './client'
import {
	transmuteAuthSchema,
	transmuteConvertBatchInputSchema,
	transmuteConvertBatchOutputSchema,
	transmuteConvertInputSchema,
	transmuteConvertOutputSchema
} from './contracts'

export const transmuteConvertTool = defineTool({
	id: 'transmute-convert',
	name: 'transmuteConvert',
	description:
		'Convert a file ArtifactRef via Transmute. Reads from object storage, converts, writes the result back, and returns a new ArtifactRef. Source store must be object.',
	inputSchema: transmuteConvertInputSchema,
	outputSchema: transmuteConvertOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => TransmuteClient.fromContext(ctx).convert(input)
})

export const transmuteConvertBatchTool = defineTool({
	id: 'transmute-convert-batch',
	name: 'transmuteConvertBatch',
	description:
		'Convert up to 10 file ArtifactRefs via Transmute. Returns per-item success or error without aborting the whole batch.',
	inputSchema: transmuteConvertBatchInputSchema,
	outputSchema: transmuteConvertBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => TransmuteClient.fromContext(ctx).convertBatch(input)
})

export const transmuteModule = defineModule({
	id: 'transmute',
	title: 'Transmute',
	description:
		'Transmute vendor pack: convert ArtifactRef objects via self-hosted Transmute and write results back to object storage (batch supported).',
	runtime: 'both',
	auth: { type: 'custom', schema: transmuteAuthSchema },
	tools: [transmuteConvertTool, transmuteConvertBatchTool]
})
