/**
 * Amazon SP-API: LWA body, order/inventory parse (no HTTP).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import type { AmazonSpApiInventorySummary, AmazonSpApiOrder } from './contracts'

export const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

export function lwaTokenBody(auth: { client_id: string; client_secret: string; refresh_token: string }): string {
	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: auth.refresh_token,
		client_id: auth.client_id,
		client_secret: auth.client_secret
	})
	return params.toString()
}

export function parseLwaAccessToken(data: unknown): string {
	if (!isPlainObject(data) || !isString(data['access_token']) || data['access_token'].length === 0) {
		throw new ToolError('Amazon LWA did not return an access_token', { code: 'bad_auth' })
	}
	return data['access_token']
}

export function parseOrder(value: unknown): AmazonSpApiOrder {
	if (!isPlainObject(value) || !isString(value['AmazonOrderId']) || value['AmazonOrderId'].length === 0) {
		throw new ToolError('Amazon SP-API returned an invalid order', { code: 'upstream' })
	}
	const total = value['OrderTotal']
	const amount = isPlainObject(total) && isString(total['Amount']) ? total['Amount'] : undefined
	const currency = isPlainObject(total) && isString(total['CurrencyCode']) ? total['CurrencyCode'] : undefined
	return {
		amazon_order_id: value['AmazonOrderId'],
		...(isString(value['OrderStatus']) && { order_status: value['OrderStatus'] }),
		...(isString(value['PurchaseDate']) && { purchase_date: value['PurchaseDate'] }),
		...(isString(value['LastUpdateDate']) && { last_update_date: value['LastUpdateDate'] }),
		...(isString(value['MarketplaceId']) && { marketplace_id: value['MarketplaceId'] }),
		...(amount && { order_total_amount: amount }),
		...(currency && { order_total_currency: currency }),
		...(isString(value['FulfillmentChannel']) && { fulfillment_channel: value['FulfillmentChannel'] })
	}
}

export function parseOrdersPayload(data: unknown): {
	items: AmazonSpApiOrder[]
	nextToken?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Amazon SP-API orders payload invalid', { code: 'upstream' })
	}
	const payload = data['payload']
	if (!isPlainObject(payload)) {
		throw new ToolError('Amazon SP-API orders missing payload', { code: 'upstream' })
	}
	const orders = payload['Orders']
	if (!Array.isArray(orders)) {
		throw new ToolError('Amazon SP-API orders missing Orders array', { code: 'upstream' })
	}
	const nextToken = isString(payload['NextToken']) && payload['NextToken'].length > 0 ? payload['NextToken'] : undefined
	return { items: orders.map(parseOrder), ...(nextToken && { nextToken }) }
}

export function parseOrderPayload(data: unknown): AmazonSpApiOrder {
	if (!isPlainObject(data) || !isPlainObject(data['payload'])) {
		throw new ToolError('Amazon SP-API get order payload invalid', { code: 'upstream' })
	}
	return parseOrder(data['payload'])
}

export function parseInventorySummary(value: unknown): AmazonSpApiInventorySummary {
	if (!isPlainObject(value)) {
		throw new ToolError('Amazon SP-API returned an invalid inventory summary', { code: 'upstream' })
	}
	const totals = value['inventoryDetails']
	let totalQuantity: number | undefined
	if (isPlainObject(totals) && typeof totals['fulfillableQuantity'] === 'number') {
		totalQuantity = totals['fulfillableQuantity']
	} else if (typeof value['totalQuantity'] === 'number') {
		totalQuantity = value['totalQuantity']
	}
	return {
		...(isString(value['sellerSku']) && { seller_sku: value['sellerSku'] }),
		...(isString(value['asin']) && { asin: value['asin'] }),
		...(isString(value['fnSku']) && { fn_sku: value['fnSku'] }),
		...(isString(value['condition']) && { condition: value['condition'] }),
		...(totalQuantity !== undefined && { total_quantity: totalQuantity }),
		...(isString(value['productName']) && { product_name: value['productName'] })
	}
}

export function parseInventoryPayload(data: unknown): {
	items: AmazonSpApiInventorySummary[]
	nextToken?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Amazon SP-API inventory payload invalid', { code: 'upstream' })
	}
	const payload = data['payload']
	if (!isPlainObject(payload)) {
		throw new ToolError('Amazon SP-API inventory missing payload', { code: 'upstream' })
	}
	const summaries = payload['inventorySummaries']
	if (!Array.isArray(summaries)) {
		throw new ToolError('Amazon SP-API inventory missing inventorySummaries', { code: 'upstream' })
	}
	const pagination = payload['pagination']
	const nextToken =
		isPlainObject(pagination) && isString(pagination['nextToken']) && pagination['nextToken'].length > 0
			? pagination['nextToken']
			: undefined
	return { items: summaries.map(parseInventorySummary), ...(nextToken && { nextToken }) }
}

export function requireMarketplaceIds(
	inputIds: string[] | undefined,
	authIds: string[] | undefined,
	label: string
): string[] {
	const ids = inputIds ?? authIds
	if (!ids || ids.length === 0) {
		throw new ToolError(`${label} requires marketplace_ids on the call or auth`, { code: 'bad_input' })
	}
	return ids
}
