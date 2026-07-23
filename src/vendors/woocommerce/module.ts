import { defineModule, defineTool } from '../../core/define'
import { WoocommerceClient } from './client'
import {
	woocommerceAuthSchema,
	woocommerceGetOrderInputSchema,
	woocommerceGetOrderOutputSchema,
	woocommerceGetProductInputSchema,
	woocommerceGetProductOutputSchema,
	woocommerceListOrdersInputSchema,
	woocommerceListOrdersOutputSchema,
	woocommerceListProductsInputSchema,
	woocommerceListProductsOutputSchema
} from './contracts'

export const woocommerceListOrdersTool = defineTool({
	id: 'woocommerce-list-orders',
	name: 'woocommerceListOrders',
	description:
		'List WooCommerce orders with optional status, date, search, and customer filters. Paginate with cursor (page number).',
	inputSchema: woocommerceListOrdersInputSchema,
	outputSchema: woocommerceListOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listOrders(input)
})

export const woocommerceGetOrderTool = defineTool({
	id: 'woocommerce-get-order',
	name: 'woocommerceGetOrder',
	description: 'Get one WooCommerce order by numeric order id.',
	inputSchema: woocommerceGetOrderInputSchema,
	outputSchema: woocommerceGetOrderOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).getOrder(input)
})

export const woocommerceListProductsTool = defineTool({
	id: 'woocommerce-list-products',
	name: 'woocommerceListProducts',
	description: 'List WooCommerce products with optional status, search, and SKU filters. Paginate with cursor.',
	inputSchema: woocommerceListProductsInputSchema,
	outputSchema: woocommerceListProductsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listProducts(input)
})

export const woocommerceGetProductTool = defineTool({
	id: 'woocommerce-get-product',
	name: 'woocommerceGetProduct',
	description: 'Get one WooCommerce product by numeric product id.',
	inputSchema: woocommerceGetProductInputSchema,
	outputSchema: woocommerceGetProductOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).getProduct(input)
})

export const woocommerceModule = defineModule({
	id: 'woocommerce',
	title: 'WooCommerce',
	description:
		'WooCommerce REST API vendor pack (wc/v3): list and get orders and products. Expand with more WooCommerce APIs over time.',
	runtime: 'both',
	auth: { type: 'custom', schema: woocommerceAuthSchema },
	tools: [woocommerceListOrdersTool, woocommerceGetOrderTool, woocommerceListProductsTool, woocommerceGetProductTool]
})
