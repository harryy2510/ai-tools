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

describe('katana', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(katanaModule).ok).toBe(true)
		expect(katanaModule.tools.map((t) => t.id).sort()).toEqual(['katana-get-sales-order', 'katana-list-sales-orders'])
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

	test('getSalesOrder tool', async () => {
		const bound = withAuth(katanaModule, auth)
		const tool = bound.tools.find((t) => t.id === 'katana-get-sales-order')
		if (!tool) throw new Error('missing tool')

		const restore = mockFetch((url) => {
			expect(url).toContain('/sales_orders/3')
			return new Response(JSON.stringify({ data: { id: 3, order_no: 'SO-3' } }), { status: 200 })
		})
		try {
			const result = await runTool(tool, { sales_order_id: 3 })
			expect(result).toEqual({ sales_order: { id: 3, order_no: 'SO-3' } })
		} finally {
			restore()
		}
	})
})
