import { z } from 'zod'

/** SP-API regional endpoints. */
export const amazonSpApiEndpointSchema = z.enum([
	'https://sellingpartnerapi-na.amazon.com',
	'https://sellingpartnerapi-eu.amazon.com',
	'https://sellingpartnerapi-fe.amazon.com'
])

export const amazonSpApiAuthSchema = z.object({
	client_id: z.string().min(1).describe('LWA client id'),
	client_secret: z.string().min(1).describe('LWA client secret'),
	refresh_token: z.string().min(1).describe('LWA refresh token for the selling partner'),
	access_key_id: z.string().min(1).describe('AWS access key id for SP-API SigV4'),
	secret_access_key: z.string().min(1).describe('AWS secret access key for SP-API SigV4'),
	region: z
		.string()
		.min(1)
		.describe('AWS region used for SigV4 (typically us-east-1 for NA, eu-west-1 for EU, us-west-2 for FE)'),
	endpoint: amazonSpApiEndpointSchema.describe('SP-API regional endpoint'),
	session_token: z.string().min(1).optional().describe('Optional AWS session token'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Default marketplace ids when a tool call omits marketplace_ids')
})

export type AmazonSpApiAuth = z.infer<typeof amazonSpApiAuthSchema>

export const amazonSpApiListOrdersInputSchema = z.object({
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids (defaults to auth.marketplace_ids)'),
	created_after: z.string().min(1).optional().describe('ISO 8601; orders created after'),
	created_before: z.string().min(1).optional().describe('ISO 8601; orders created before'),
	last_updated_after: z.string().min(1).optional().describe('ISO 8601; orders updated after'),
	order_statuses: z.array(z.string().min(1)).optional().describe('Order status filter list'),
	cursor: z.string().min(1).optional().describe('NextToken from a prior page'),
	max_results: z.int().min(1).max(100).optional().describe('Page size (1-100)')
})

export const amazonSpApiOrderSchema = z.object({
	amazon_order_id: z.string(),
	order_status: z.string().optional(),
	purchase_date: z.string().optional(),
	last_update_date: z.string().optional(),
	marketplace_id: z.string().optional(),
	order_total_amount: z.string().optional(),
	order_total_currency: z.string().optional(),
	fulfillment_channel: z.string().optional()
})

export const amazonSpApiListOrdersOutputSchema = z.object({
	items: z.array(amazonSpApiOrderSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const amazonSpApiGetOrderInputSchema = z.object({
	amazon_order_id: z.string().min(1).describe('Amazon order id')
})

export const amazonSpApiGetOrderOutputSchema = z.object({
	order: amazonSpApiOrderSchema
})

export const amazonSpApiListInventorySummariesInputSchema = z.object({
	marketplace_id: z.string().min(1).optional().describe('Marketplace id (defaults to first auth.marketplace_ids)'),
	seller_skus: z.array(z.string().min(1)).max(50).optional().describe('Optional seller SKU filter (max 50)'),
	start_date_time: z.string().min(1).optional().describe('ISO 8601; summaries changed after'),
	cursor: z.string().min(1).optional().describe('nextToken from a prior page')
})

export const amazonSpApiInventorySummarySchema = z.object({
	seller_sku: z.string().optional(),
	asin: z.string().optional(),
	fn_sku: z.string().optional(),
	condition: z.string().optional(),
	total_quantity: z.number().optional(),
	product_name: z.string().optional()
})

export const amazonSpApiListInventorySummariesOutputSchema = z.object({
	items: z.array(amazonSpApiInventorySummarySchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export type AmazonSpApiListOrdersInput = z.infer<typeof amazonSpApiListOrdersInputSchema>
export type AmazonSpApiListOrdersOutput = z.infer<typeof amazonSpApiListOrdersOutputSchema>
export type AmazonSpApiGetOrderInput = z.infer<typeof amazonSpApiGetOrderInputSchema>
export type AmazonSpApiGetOrderOutput = z.infer<typeof amazonSpApiGetOrderOutputSchema>
export type AmazonSpApiListInventorySummariesInput = z.infer<typeof amazonSpApiListInventorySummariesInputSchema>
export type AmazonSpApiListInventorySummariesOutput = z.infer<typeof amazonSpApiListInventorySummariesOutputSchema>
export type AmazonSpApiOrder = z.infer<typeof amazonSpApiOrderSchema>
export type AmazonSpApiInventorySummary = z.infer<typeof amazonSpApiInventorySummarySchema>
