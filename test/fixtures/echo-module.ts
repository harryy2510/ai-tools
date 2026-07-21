import { z } from 'zod'

import { defineModule, defineTool } from '../../src/core'

/** Brain-only fixture: no product tool, no network. */
export const echoTool = defineTool({
	id: 'echo-message',
	name: 'echoMessage',
	description: 'Echo a short message back. Use when testing tool wiring.',
	inputSchema: z.object({
		message: z.string().min(1).max(200).describe('Text to echo')
	}),
	outputSchema: z.object({
		message: z.string().describe('Echoed text')
	}),
	sideEffect: 'none',
	runtime: 'both',
	execute: async ({ message }) => ({ message })
})

export const echoModule = defineModule({
	id: 'echo',
	title: 'Echo',
	description: 'Fixture module for adapter and contract tests.',
	auth: { type: 'none' },
	tools: [echoTool]
})
