import { defineModule, defineTool } from '../../core/define'
import { AmazonSpApiClient } from './client'
import {
	amazonSpApiAuthSchema,
	amazonSpApiGetOrderInputSchema,
	amazonSpApiGetOrderOutputSchema,
	amazonSpApiListInventorySummariesInputSchema,
	amazonSpApiListInventorySummariesOutputSchema,
	amazonSpApiListOrdersInputSchema,
	amazonSpApiListOrdersOutputSchema
} from './contracts'

export const amazonSpApiListOrdersTool = defineTool({
	id: 'amazon-sp-api-list-orders',
	name: 'amazonSpApiListOrders',
	description:
		'List Amazon SP-API orders for one or more marketplaces. Optional date and status filters. Paginate with next_cursor (NextToken).',
	inputSchema: amazonSpApiListOrdersInputSchema,
	outputSchema: amazonSpApiListOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).listOrders(input)
})

export const amazonSpApiGetOrderTool = defineTool({
	id: 'amazon-sp-api-get-order',
	name: 'amazonSpApiGetOrder',
	description: 'Get one Amazon SP-API order by AmazonOrderId.',
	inputSchema: amazonSpApiGetOrderInputSchema,
	outputSchema: amazonSpApiGetOrderOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).getOrder(input)
})

export const amazonSpApiListInventorySummariesTool = defineTool({
	id: 'amazon-sp-api-list-inventory-summaries',
	name: 'amazonSpApiListInventorySummaries',
	description:
		'List FBA inventory summaries for a marketplace. Optional seller SKUs and start_date_time. Paginate with next_cursor.',
	inputSchema: amazonSpApiListInventorySummariesInputSchema,
	outputSchema: amazonSpApiListInventorySummariesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).listInventorySummaries(input)
})

export const amazonSpApiModule = defineModule({
	id: 'amazon-sp-api',
	title: 'Amazon SP-API',
	description:
		'Amazon Selling Partner API vendor pack: list/get orders and FBA inventory summaries. Expand with reports and more APIs over time.',
	runtime: 'both',
	auth: { type: 'custom', schema: amazonSpApiAuthSchema },
	tools: [amazonSpApiListOrdersTool, amazonSpApiGetOrderTool, amazonSpApiListInventorySummariesTool]
})
