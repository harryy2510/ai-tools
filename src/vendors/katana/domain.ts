/**
 * Katana MRP payload helpers (no HTTP).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import type { KatanaSalesOrder } from './contracts'

export const KATANA_API_BASE = 'https://api.katanamrp.com/v1'

export function pageFromCursor(cursor: string | undefined): number {
	if (!cursor) return 1
	const n = Number.parseInt(cursor, 10)
	if (!Number.isFinite(n) || n < 1) {
		throw new ToolError('Invalid list cursor', { code: 'bad_input', details: { cursor } })
	}
	return n
}

export function parseSalesOrder(value: unknown): KatanaSalesOrder {
	if (!isPlainObject(value) || typeof value['id'] !== 'number') {
		throw new ToolError('Katana returned an invalid sales order', { code: 'upstream' })
	}
	const totalRaw = value['total'] ?? value['total_price']
	const total = typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : undefined
	return {
		id: value['id'],
		...(isString(value['order_no']) && { order_no: value['order_no'] }),
		...(isString(value['status']) && { status: value['status'] }),
		...(typeof value['customer_id'] === 'number' && { customer_id: value['customer_id'] }),
		...(isString(value['order_created_date']) && { order_created_date: value['order_created_date'] }),
		...(isString(value['currency']) && { currency: value['currency'] }),
		...(total !== undefined && { total })
	}
}

export function parseSalesOrdersEnvelope(data: unknown): {
	items: KatanaSalesOrder[]
	totalPages?: number
} {
	if (Array.isArray(data)) {
		return { items: data.map(parseSalesOrder) }
	}
	if (!isPlainObject(data)) {
		throw new ToolError('Katana returned an unexpected sales orders payload', { code: 'upstream' })
	}
	const rows = data['data']
	if (!Array.isArray(rows)) {
		throw new ToolError('Katana sales orders missing data array', { code: 'upstream' })
	}
	const pagination = data['pagination']
	let totalPages: number | undefined
	if (isPlainObject(pagination) && typeof pagination['total_pages'] === 'number') {
		totalPages = pagination['total_pages']
	}
	return { items: rows.map(parseSalesOrder), ...(totalPages !== undefined && { totalPages }) }
}

export function listPageMeta(
	page: number,
	limit: number,
	itemCount: number,
	totalPages: number | undefined
): { next_cursor?: string; truncated: boolean } {
	if (typeof totalPages === 'number' && totalPages > page) {
		return { next_cursor: String(page + 1), truncated: true }
	}
	if (itemCount >= limit && totalPages === undefined) {
		return { next_cursor: String(page + 1), truncated: true }
	}
	return { truncated: false }
}
