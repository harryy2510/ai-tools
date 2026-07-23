/**
 * WooCommerce REST payload helpers (no HTTP).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { bytesToBase64, utf8ToBytes } from '../../shared/bytes'
import type { WoocommerceAuth, WoocommerceOrder, WoocommerceProduct } from './contracts'

export function storeOrigin(auth: WoocommerceAuth): string {
	return auth.store_url.replace(/\/+$/, '')
}

export function apiBaseUrl(auth: WoocommerceAuth): string {
	return `${storeOrigin(auth)}/wp-json/wc/v3`
}

export function basicAuthHeader(auth: WoocommerceAuth): string {
	const token = bytesToBase64(utf8ToBytes(`${auth.consumer_key}:${auth.consumer_secret}`))
	return `Basic ${token}`
}

export function pageFromCursor(cursor: string | undefined): number {
	if (!cursor) return 1
	const n = Number.parseInt(cursor, 10)
	if (!Number.isFinite(n) || n < 1) {
		throw new ToolError('Invalid list cursor', { code: 'bad_input', details: { cursor } })
	}
	return n
}

export function parseOrder(value: unknown): WoocommerceOrder {
	if (!isPlainObject(value) || typeof value['id'] !== 'number') {
		throw new ToolError('WooCommerce returned an invalid order', { code: 'upstream' })
	}
	const number = value['number']
	const status = value['status']
	const currency = value['currency']
	const total = value['total']
	if (!isString(number) || !isString(status) || !isString(currency) || !isString(total)) {
		throw new ToolError('WooCommerce order missing required fields', { code: 'upstream' })
	}
	return {
		id: value['id'],
		number,
		status,
		currency,
		total,
		...(isString(value['date_created']) && { date_created: value['date_created'] }),
		...(typeof value['customer_id'] === 'number' && { customer_id: value['customer_id'] })
	}
}

export function parseOrders(value: unknown): WoocommerceOrder[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list orders returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseOrder)
}

export function parseProduct(value: unknown): WoocommerceProduct {
	if (
		!isPlainObject(value) ||
		typeof value['id'] !== 'number' ||
		!isString(value['name']) ||
		!isString(value['type'])
	) {
		throw new ToolError('WooCommerce returned an invalid product', { code: 'upstream' })
	}
	const status = value['status']
	if (!isString(status)) {
		throw new ToolError('WooCommerce product missing status', { code: 'upstream' })
	}
	return {
		id: value['id'],
		name: value['name'],
		type: value['type'],
		status,
		...(isString(value['sku']) && value['sku'].length > 0 && { sku: value['sku'] }),
		...(isString(value['price']) && { price: value['price'] }),
		...(isString(value['stock_status']) && { stock_status: value['stock_status'] })
	}
}

export function parseProducts(value: unknown): WoocommerceProduct[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list products returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseProduct)
}

export function listPageMeta(
	page: number,
	limit: number,
	itemCount: number,
	totalPagesHeader: string | null
): { next_cursor?: string; truncated: boolean } {
	const totalPages = totalPagesHeader ? Number.parseInt(totalPagesHeader, 10) : undefined
	if (typeof totalPages === 'number' && Number.isFinite(totalPages) && totalPages > page) {
		return { next_cursor: String(page + 1), truncated: true }
	}
	if (itemCount >= limit && (totalPages === undefined || !Number.isFinite(totalPages))) {
		return { next_cursor: String(page + 1), truncated: true }
	}
	return { truncated: false }
}
