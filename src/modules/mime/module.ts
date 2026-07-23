import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'

const mimePingTool = defineTool({
	id: 'mime-ping',
	name: 'ping',
	description: 'Connectivity check for Mime. Returns ok.',
	inputSchema: z.object({}),
	outputSchema: z.object({ ok: z.literal(true) }),
	sideEffect: 'none',
	runtime: 'both',
	execute: async () => ({ ok: true as const })
})

export const mimeModule = defineModule({
	id: 'mime',
	title: 'Mime',
	description: 'Mime tools.',
	runtime: 'both',
	auth: { type: 'none' },
	tools: [mimePingTool]
})

export { mimePingTool }
