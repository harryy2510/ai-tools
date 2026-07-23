import { defineModule, defineTool } from '../../core/define'
import { WebFetchClient } from './client'
import {
	webFetchAuthSchema,
	webFetchGetInputSchema,
	webFetchRequestInputSchema,
	webFetchRequestOutputSchema
} from './contracts'

export type { WebFetchAuth } from './contracts'
export { webFetchAuthSchema }

export const webFetchGetTool = defineTool({
	id: 'web-fetch-get',
	name: 'httpGet',
	description:
		'HTTP GET or HEAD against an absolute allowlisted URL. Use to read host-approved APIs. Returns status, headers, and ofetch-parsed body (JSON object when the response is JSON). No request body. Credential headers cannot be set from tool arguments.',
	inputSchema: webFetchGetInputSchema,
	outputSchema: webFetchRequestOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WebFetchClient.fromContext(ctx).get(input)
})

export const webFetchRequestTool = defineTool({
	id: 'web-fetch-request',
	name: 'httpRequest',
	description:
		'HTTP POST, PUT, PATCH, or DELETE against an absolute allowlisted URL. Use for host-approved write/delete APIs and webhooks. Body accepts a string or object (objects/arrays are JSON-encoded automatically). Returns status, headers, and ofetch-parsed body. Credential headers cannot be set from tool arguments.',
	inputSchema: webFetchRequestInputSchema,
	outputSchema: webFetchRequestOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WebFetchClient.fromContext(ctx).request(input)
})

export const webFetchModule = defineModule({
	id: 'web-fetch',
	title: 'Web Fetch',
	description:
		'Allowlisted HTTP client (ofetch). Hosts bind origins and optional default headers; models call URLs without setting credentials. GET/HEAD are read; POST/PUT/PATCH/DELETE are write.',
	runtime: 'both',
	auth: { type: 'custom', schema: webFetchAuthSchema },
	tools: [webFetchGetTool, webFetchRequestTool]
})
