import { z } from 'zod'

export const woocommerceAuthSchema = z.object({
	store_url: z.url().describe('WooCommerce store origin, for example https://shop.example.com (no trailing path)'),
	consumer_key: z.string().min(1).describe('WooCommerce REST API consumer key'),
	consumer_secret: z.string().min(1).describe('WooCommerce REST API consumer secret')
})

export type WoocommerceAuth = z.infer<typeof woocommerceAuthSchema>

export const woocommerceListOrdersInputSchema = z.object({
	status: z.string().min(1).optional().describe('Order status filter (e.g. processing, completed)'),
	after: z.string().min(1).optional().describe('ISO 8601 datetime; orders created after this'),
	before: z.string().min(1).optional().describe('ISO 8601 datetime; orders created before this'),
	search: z.string().min(1).optional().describe('Search term (order number, customer, …)'),
	customer_id: z.int().positive().optional().describe('Filter by customer id'),
	cursor: z.string().min(1).optional().describe('Page number from a prior next_cursor'),
	limit: z.int().min(1).max(100).optional().describe('Page size (1-100, default 10)')
})

export const woocommerceOrderSchema = z.object({
	id: z.number(),
	number: z.string(),
	status: z.string(),
	currency: z.string(),
	total: z.string(),
	date_created: z.string().optional(),
	customer_id: z.number().optional()
})

export const woocommerceListOrdersOutputSchema = z.object({
	items: z.array(woocommerceOrderSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceGetOrderInputSchema = z.object({
	order_id: z.int().positive().describe('WooCommerce order id')
})

export const woocommerceGetOrderOutputSchema = z.object({
	order: woocommerceOrderSchema
})

export const woocommerceListProductsInputSchema = z.object({
	status: z.string().min(1).optional().describe('Product status (publish, draft, …)'),
	search: z.string().min(1).optional().describe('Search term'),
	sku: z.string().min(1).optional().describe('Exact SKU filter'),
	cursor: z.string().min(1).optional().describe('Page number from a prior next_cursor'),
	limit: z.int().min(1).max(100).optional().describe('Page size (1-100, default 10)')
})

export const woocommerceProductSchema = z.object({
	id: z.number(),
	name: z.string(),
	sku: z.string().optional(),
	type: z.string(),
	status: z.string(),
	price: z.string().optional(),
	stock_status: z.string().optional()
})

export const woocommerceListProductsOutputSchema = z.object({
	items: z.array(woocommerceProductSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceGetProductInputSchema = z.object({
	product_id: z.int().positive().describe('WooCommerce product id')
})

export const woocommerceGetProductOutputSchema = z.object({
	product: woocommerceProductSchema
})

export type WoocommerceListOrdersInput = z.infer<typeof woocommerceListOrdersInputSchema>
export type WoocommerceListOrdersOutput = z.infer<typeof woocommerceListOrdersOutputSchema>
export type WoocommerceGetOrderInput = z.infer<typeof woocommerceGetOrderInputSchema>
export type WoocommerceGetOrderOutput = z.infer<typeof woocommerceGetOrderOutputSchema>
export type WoocommerceListProductsInput = z.infer<typeof woocommerceListProductsInputSchema>
export type WoocommerceListProductsOutput = z.infer<typeof woocommerceListProductsOutputSchema>
export type WoocommerceGetProductInput = z.infer<typeof woocommerceGetProductInputSchema>
export type WoocommerceGetProductOutput = z.infer<typeof woocommerceGetProductOutputSchema>
export type WoocommerceOrder = z.infer<typeof woocommerceOrderSchema>
export type WoocommerceProduct = z.infer<typeof woocommerceProductSchema>
