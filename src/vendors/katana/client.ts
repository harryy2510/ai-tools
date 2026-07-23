/**
 * Katana MRP vendor client.
 * Host: `new KatanaClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	KatanaAuth,
	KatanaGetSalesOrderInput,
	KatanaGetSalesOrderOutput,
	KatanaListSalesOrdersInput,
	KatanaListSalesOrdersOutput
} from './contracts'
import { katanaAuthSchema } from './contracts'
import { KATANA_API_BASE, listPageMeta, pageFromCursor, parseSalesOrder, parseSalesOrdersEnvelope } from './domain'

export type KatanaClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class KatanaClient {
	readonly #http: HttpService

	constructor(auth: KatanaAuth, options: KatanaClientOptions = {}) {
		const parsed = katanaAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Katana auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#http = new HttpService({
			...options,
			baseURL: KATANA_API_BASE,
			headers: {
				Authorization: `Bearer ${parsed.data.api_key}`,
				'Content-Type': 'application/json'
			},
			label: 'Katana'
		})
	}

	static fromContext(ctx: ToolContext): KatanaClient {
		const auth = requireAuth(ctx, katanaAuthSchema)
		return new KatanaClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** GET /sales_orders */
	async listSalesOrders(input: KatanaListSalesOrdersInput = {}): Promise<KatanaListSalesOrdersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/sales_orders', {
			label: 'Katana listSalesOrders',
			query: {
				page,
				limit,
				...(input.status && { status: input.status }),
				...(input.customer_id !== undefined && { customer_id: input.customer_id }),
				...(input.order_no && { order_no: input.order_no })
			}
		})
		const parsed = parseSalesOrdersEnvelope(data)
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /sales_orders/{id} */
	async getSalesOrder(input: KatanaGetSalesOrderInput): Promise<KatanaGetSalesOrderOutput> {
		const { data } = await this.#http.get(`/sales_orders/${input.sales_order_id}`, {
			label: 'Katana getSalesOrder'
		})
		const row = isEnvelopeData(data) ? data['data'] : data
		return { sales_order: parseSalesOrder(row) }
	}
}

function isEnvelopeData(value: unknown): value is { data: unknown } {
	return typeof value === 'object' && value !== null && 'data' in value
}
