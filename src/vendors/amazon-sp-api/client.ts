/**
 * Amazon Selling Partner API vendor client.
 * Host: `new AmazonSpApiClient(auth)`. Agent tools: `fromContext(ctx)`.
 *
 * LWA refresh → access token; SP-API calls use AwsService (SigV4 execute-api)
 * plus x-amz-access-token.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { AwsService } from '../../transport/aws-service'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	AmazonSpApiAuth,
	AmazonSpApiGetOrderInput,
	AmazonSpApiGetOrderOutput,
	AmazonSpApiListInventorySummariesInput,
	AmazonSpApiListInventorySummariesOutput,
	AmazonSpApiListOrdersInput,
	AmazonSpApiListOrdersOutput
} from './contracts'
import { amazonSpApiAuthSchema } from './contracts'
import {
	LWA_TOKEN_URL,
	lwaTokenBody,
	parseInventoryPayload,
	parseLwaAccessToken,
	parseOrderPayload,
	parseOrdersPayload,
	requireMarketplaceIds
} from './domain'

export type AmazonSpApiClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class AmazonSpApiClient {
	readonly #auth: AmazonSpApiAuth
	readonly #lwa: HttpService
	readonly #api: AwsService
	#accessToken: string | undefined
	#accessTokenExpiresAt = 0

	constructor(auth: AmazonSpApiAuth, options: AmazonSpApiClientOptions = {}) {
		const parsed = amazonSpApiAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Amazon SP-API auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#lwa = new HttpService({
			...options,
			label: 'Amazon LWA'
		})
		this.#api = new AwsService({
			...options,
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 'execute-api',
			baseURL: this.#auth.endpoint,
			label: 'Amazon SP-API',
			...(this.#auth.session_token && { sessionToken: this.#auth.session_token })
		})
	}

	static fromContext(ctx: ToolContext): AmazonSpApiClient {
		const auth = requireAuth(ctx, amazonSpApiAuthSchema)
		return new AmazonSpApiClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async #ensureAccessToken(): Promise<string> {
		const now = Date.now()
		if (this.#accessToken && now < this.#accessTokenExpiresAt - 60_000) {
			return this.#accessToken
		}
		const { data } = await this.#lwa.post(LWA_TOKEN_URL, lwaTokenBody(this.#auth), {
			label: 'Amazon LWA token',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
		})
		const token = parseLwaAccessToken(data)
		this.#accessToken = token
		// LWA tokens last ~1h; refresh early without relying on expires_in type noise
		this.#accessTokenExpiresAt = now + 3_000_000
		return token
	}

	async #spGet(path: string, label: string, query?: Record<string, string | number | boolean | undefined>) {
		const token = await this.#ensureAccessToken()
		return this.#api.get(path, {
			label,
			headers: { 'x-amz-access-token': token },
			...(query && { query })
		})
	}

	/** GET /orders/v0/orders */
	async listOrders(input: AmazonSpApiListOrdersInput = {}): Promise<AmazonSpApiListOrdersOutput> {
		const marketplaceIds = requireMarketplaceIds(
			input.marketplace_ids,
			this.#auth.marketplace_ids,
			'Amazon SP-API listOrders'
		)
		const { data } = await this.#spGet('/orders/v0/orders', 'Amazon SP-API listOrders', {
			MarketplaceIds: marketplaceIds.join(','),
			...(input.created_after && { CreatedAfter: input.created_after }),
			...(input.created_before && { CreatedBefore: input.created_before }),
			...(input.last_updated_after && { LastUpdatedAfter: input.last_updated_after }),
			...(input.order_statuses &&
				input.order_statuses.length > 0 && {
					OrderStatuses: input.order_statuses.join(',')
				}),
			...(input.cursor && { NextToken: input.cursor }),
			...(input.max_results !== undefined && { MaxResultsPerPage: input.max_results })
		})
		const parsed = parseOrdersPayload(data)
		return {
			items: parsed.items,
			truncated: Boolean(parsed.nextToken),
			...(parsed.nextToken && { next_cursor: parsed.nextToken })
		}
	}

	/** GET /orders/v0/orders/{orderId} */
	async getOrder(input: AmazonSpApiGetOrderInput): Promise<AmazonSpApiGetOrderOutput> {
		const { data } = await this.#spGet(
			`/orders/v0/orders/${encodeURIComponent(input.amazon_order_id)}`,
			'Amazon SP-API getOrder'
		)
		return { order: parseOrderPayload(data) }
	}

	/** GET /fba/inventory/v1/summaries */
	async listInventorySummaries(
		input: AmazonSpApiListInventorySummariesInput = {}
	): Promise<AmazonSpApiListInventorySummariesOutput> {
		const marketplaceIds = requireMarketplaceIds(
			input.marketplace_id ? [input.marketplace_id] : undefined,
			this.#auth.marketplace_ids,
			'Amazon SP-API listInventorySummaries'
		)
		const marketplaceId = marketplaceIds[0]
		if (!marketplaceId) {
			throw new ToolError('Amazon SP-API listInventorySummaries requires a marketplace_id', {
				code: 'bad_input'
			})
		}
		const { data } = await this.#spGet('/fba/inventory/v1/summaries', 'Amazon SP-API listInventorySummaries', {
			details: true,
			granularityType: 'Marketplace',
			granularityId: marketplaceId,
			marketplaceIds: marketplaceId,
			...(input.seller_skus && input.seller_skus.length > 0 && { sellerSkus: input.seller_skus.join(',') }),
			...(input.start_date_time && { startDateTime: input.start_date_time }),
			...(input.cursor && { nextToken: input.cursor })
		})
		const parsed = parseInventoryPayload(data)
		return {
			items: parsed.items,
			truncated: Boolean(parsed.nextToken),
			...(parsed.nextToken && { next_cursor: parsed.nextToken })
		}
	}
}
