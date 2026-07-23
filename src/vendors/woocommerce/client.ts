/**
 * WooCommerce REST API vendor client (wc/v3).
 * Host: `new WoocommerceClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	WoocommerceAuth,
	WoocommerceGetOrderInput,
	WoocommerceGetOrderOutput,
	WoocommerceGetProductInput,
	WoocommerceGetProductOutput,
	WoocommerceListOrdersInput,
	WoocommerceListOrdersOutput,
	WoocommerceListProductsInput,
	WoocommerceListProductsOutput
} from './contracts'
import { woocommerceAuthSchema } from './contracts'
import {
	apiBaseUrl,
	basicAuthHeader,
	listPageMeta,
	pageFromCursor,
	parseOrder,
	parseOrders,
	parseProduct,
	parseProducts
} from './domain'

export type WoocommerceClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class WoocommerceClient {
	readonly #http: HttpService

	constructor(auth: WoocommerceAuth, options: WoocommerceClientOptions = {}) {
		const parsed = woocommerceAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid WooCommerce auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#http = new HttpService({
			...options,
			baseURL: apiBaseUrl(parsed.data),
			headers: {
				Authorization: basicAuthHeader(parsed.data),
				'Content-Type': 'application/json'
			},
			label: 'WooCommerce'
		})
	}

	static fromContext(ctx: ToolContext): WoocommerceClient {
		const auth = requireAuth(ctx, woocommerceAuthSchema)
		return new WoocommerceClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** GET /orders */
	async listOrders(input: WoocommerceListOrdersInput = {}): Promise<WoocommerceListOrdersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get('/orders', {
			label: 'WooCommerce listOrders',
			query: {
				page,
				per_page: limit,
				...(input.status && { status: input.status }),
				...(input.after && { after: input.after }),
				...(input.before && { before: input.before }),
				...(input.search && { search: input.search }),
				...(input.customer_id !== undefined && { customer: input.customer_id })
			}
		})
		const items = parseOrders(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /orders/{id} */
	async getOrder(input: WoocommerceGetOrderInput): Promise<WoocommerceGetOrderOutput> {
		const { data } = await this.#http.get(`/orders/${input.order_id}`, { label: 'WooCommerce getOrder' })
		return { order: parseOrder(data) }
	}

	/** GET /products */
	async listProducts(input: WoocommerceListProductsInput = {}): Promise<WoocommerceListProductsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get('/products', {
			label: 'WooCommerce listProducts',
			query: {
				page,
				per_page: limit,
				...(input.status && { status: input.status }),
				...(input.search && { search: input.search }),
				...(input.sku && { sku: input.sku })
			}
		})
		const items = parseProducts(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /products/{id} */
	async getProduct(input: WoocommerceGetProductInput): Promise<WoocommerceGetProductOutput> {
		const { data } = await this.#http.get(`/products/${input.product_id}`, { label: 'WooCommerce getProduct' })
		return { product: parseProduct(data) }
	}
}
