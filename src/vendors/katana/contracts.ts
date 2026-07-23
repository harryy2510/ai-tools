import { z } from 'zod'

export const katanaAuthSchema = z.object({
	api_key: z.string().min(1).describe('Katana MRP API key (Bearer token)')
})

export type KatanaAuth = z.infer<typeof katanaAuthSchema>

export const katanaListSalesOrdersInputSchema = z.object({
	status: z.string().min(1).optional().describe('Sales order status filter'),
	customer_id: z.int().positive().optional().describe('Filter by Katana customer id'),
	order_no: z.string().min(1).optional().describe('Filter by order number'),
	cursor: z.string().min(1).optional().describe('Page number from a prior next_cursor'),
	limit: z.int().min(1).max(250).optional().describe('Page size (1-250, default 50)')
})

export const katanaSalesOrderSchema = z.object({
	id: z.number(),
	order_no: z.string().optional(),
	status: z.string().optional(),
	customer_id: z.number().optional(),
	order_created_date: z.string().optional(),
	currency: z.string().optional(),
	total: z.number().optional()
})

export const katanaListSalesOrdersOutputSchema = z.object({
	items: z.array(katanaSalesOrderSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const katanaGetSalesOrderInputSchema = z.object({
	sales_order_id: z.int().positive().describe('Katana sales order id')
})

export const katanaGetSalesOrderOutputSchema = z.object({
	sales_order: katanaSalesOrderSchema
})

export type KatanaListSalesOrdersInput = z.infer<typeof katanaListSalesOrdersInputSchema>
export type KatanaListSalesOrdersOutput = z.infer<typeof katanaListSalesOrdersOutputSchema>
export type KatanaGetSalesOrderInput = z.infer<typeof katanaGetSalesOrderInputSchema>
export type KatanaGetSalesOrderOutput = z.infer<typeof katanaGetSalesOrderOutputSchema>
export type KatanaSalesOrder = z.infer<typeof katanaSalesOrderSchema>
