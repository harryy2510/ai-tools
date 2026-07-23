import { defineModule, defineTool } from '../../core/define'
import { KatanaClient } from './client'
import {
	katanaAuthSchema,
	katanaGetSalesOrderInputSchema,
	katanaGetSalesOrderOutputSchema,
	katanaListSalesOrdersInputSchema,
	katanaListSalesOrdersOutputSchema
} from './contracts'

export const katanaListSalesOrdersTool = defineTool({
	id: 'katana-list-sales-orders',
	name: 'katanaListSalesOrders',
	description:
		'List Katana MRP sales orders with optional status, customer, and order number filters. Paginate with cursor (page number).',
	inputSchema: katanaListSalesOrdersInputSchema,
	outputSchema: katanaListSalesOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listSalesOrders(input)
})

export const katanaGetSalesOrderTool = defineTool({
	id: 'katana-get-sales-order',
	name: 'katanaGetSalesOrder',
	description: 'Get one Katana MRP sales order by numeric id.',
	inputSchema: katanaGetSalesOrderInputSchema,
	outputSchema: katanaGetSalesOrderOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).getSalesOrder(input)
})

export const katanaModule = defineModule({
	id: 'katana',
	title: 'Katana',
	description: 'Katana MRP vendor pack: list and get sales orders. Expand with more manufacturing APIs over time.',
	runtime: 'both',
	auth: { type: 'custom', schema: katanaAuthSchema },
	tools: [katanaListSalesOrdersTool, katanaGetSalesOrderTool]
})
