import { describe, expect, test } from 'bun:test'

import { validateModule, withAuth, runTool } from '../../src/core'
import { KatanaClient, katanaModule } from '../../src/vendors/katana'

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		return handler(url, init)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

const auth = { api_key: 'katana_test_key' } as const

const expectedToolIds = [
	'katana-create-customer',
	'katana-create-manufacturing-order',
	'katana-create-product',
	'katana-create-purchase-order',
	'katana-create-sales-order',
	'katana-create-supplier',
	'katana-delete-sales-order',
	'katana-get-customer',
	'katana-get-manufacturing-order',
	'katana-get-material',
	'katana-get-product',
	'katana-get-purchase-order',
	'katana-get-sales-order',
	'katana-get-supplier',
	'katana-list-customers',
	'katana-list-inventory',
	'katana-list-manufacturing-orders',
	'katana-list-materials',
	'katana-list-products',
	'katana-list-purchase-orders',
	'katana-list-sales-orders',
	'katana-list-suppliers',
	'katana-update-customer',
	'katana-update-manufacturing-order',
	'katana-update-product',
	'katana-update-purchase-order',
	'katana-update-sales-order'
]

describe('katana', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(katanaModule).ok).toBe(true)
		expect(katanaModule.tools.map((t) => t.id).sort()).toEqual(expectedToolIds)
	})

	test('listSalesOrders hits Katana API with bearer auth', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('https://api.katanamrp.com/v1/sales_orders')
			expect(init?.method).toBe('GET')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer katana_test_key')
			return new Response(
				JSON.stringify({
					data: [{ id: 9, order_no: 'SO-9', status: 'NOT_SHIPPED', total: 100 }],
					pagination: { page: 1, total_pages: 1 }
				}),
				{ status: 200 }
			)
		})

		try {
			const client = new KatanaClient(auth)
			const result = await client.listSalesOrders({})
			expect(result.items).toEqual([{ id: 9, order_no: 'SO-9', status: 'NOT_SHIPPED', total: 100 }])
			expect(result.truncated).toBe(false)
		} finally {
			restore()
		}
	})

	test('listProducts client + getSalesOrder tool', async () => {
		const restore = mockFetch((url, init) => {
			if (url.includes('/products') && !url.includes('/products/')) {
				expect(init?.method).toBe('GET')
				return new Response(
					JSON.stringify({
						data: [{ id: 4, name: 'Widget', uom: 'pcs', is_sellable: true }],
						pagination: { page: 1, total_pages: 2 }
					}),
					{ status: 200 }
				)
			}
			if (url.includes('/sales_orders/3')) {
				return new Response(JSON.stringify({ data: { id: 3, order_no: 'SO-3' } }), { status: 200 })
			}
			return new Response('not found', { status: 404 })
		})

		try {
			const client = new KatanaClient(auth)
			const products = await client.listProducts({})
			expect(products.items).toEqual([{ id: 4, name: 'Widget', uom: 'pcs', is_sellable: true }])
			expect(products.truncated).toBe(true)
			expect(products.next_cursor).toBe('2')

			const bound = withAuth(katanaModule, auth)
			const tool = bound.tools.find((t) => t.id === 'katana-get-sales-order')
			if (!tool) throw new Error('missing tool')
			const result = await runTool(tool, { sales_order_id: 3 })
			expect(result).toEqual({ sales_order: { id: 3, order_no: 'SO-3' } })
		} finally {
			restore()
		}
	})
})
