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
	KatanaCreateCustomerInput,
	KatanaCreateCustomerOutput,
	KatanaCreateManufacturingOrderInput,
	KatanaCreateManufacturingOrderOutput,
	KatanaCreateProductInput,
	KatanaCreateProductOutput,
	KatanaCreatePurchaseOrderInput,
	KatanaCreatePurchaseOrderOutput,
	KatanaCreateSalesOrderInput,
	KatanaCreateSalesOrderOutput,
	KatanaCreateSupplierInput,
	KatanaCreateSupplierOutput,
	KatanaDeleteSalesOrderInput,
	KatanaDeleteSalesOrderOutput,
	KatanaGetCustomerInput,
	KatanaGetCustomerOutput,
	KatanaGetManufacturingOrderInput,
	KatanaGetManufacturingOrderOutput,
	KatanaGetMaterialInput,
	KatanaGetMaterialOutput,
	KatanaGetProductInput,
	KatanaGetProductOutput,
	KatanaGetPurchaseOrderInput,
	KatanaGetPurchaseOrderOutput,
	KatanaGetSalesOrderInput,
	KatanaGetSalesOrderOutput,
	KatanaGetSupplierInput,
	KatanaGetSupplierOutput,
	KatanaListCustomersInput,
	KatanaListCustomersOutput,
	KatanaListInventoryInput,
	KatanaListInventoryOutput,
	KatanaListManufacturingOrdersInput,
	KatanaListManufacturingOrdersOutput,
	KatanaListMaterialsInput,
	KatanaListMaterialsOutput,
	KatanaListProductsInput,
	KatanaListProductsOutput,
	KatanaListPurchaseOrdersInput,
	KatanaListPurchaseOrdersOutput,
	KatanaListSalesOrdersInput,
	KatanaListSalesOrdersOutput,
	KatanaListSuppliersInput,
	KatanaListSuppliersOutput,
	KatanaUpdateCustomerInput,
	KatanaUpdateCustomerOutput,
	KatanaUpdateManufacturingOrderInput,
	KatanaUpdateManufacturingOrderOutput,
	KatanaUpdateProductInput,
	KatanaUpdateProductOutput,
	KatanaUpdatePurchaseOrderInput,
	KatanaUpdatePurchaseOrderOutput,
	KatanaUpdateSalesOrderInput,
	KatanaUpdateSalesOrderOutput
} from './contracts'
import { katanaAuthSchema } from './contracts'
import {
	KATANA_API_BASE,
	customerWriteBody,
	listPageMeta,
	manufacturingOrderCreateBody,
	manufacturingOrderUpdateBody,
	pageFromCursor,
	parseCustomer,
	parseInventory,
	parseListEnvelope,
	parseManufacturingOrder,
	parseMaterial,
	parseProduct,
	parsePurchaseOrder,
	parseSalesOrder,
	parseSupplier,
	productCreateBody,
	productUpdateBody,
	purchaseOrderCreateBody,
	purchaseOrderUpdateBody,
	salesOrderCreateBody,
	salesOrderUpdateBody,
	supplierCreateBody,
	unwrapResource
} from './domain'

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

	// ── Sales orders ────────────────────────────────────────────────────────

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
				...(input.order_no && { order_no: input.order_no }),
				...(input.location_id !== undefined && { location_id: input.location_id })
			}
		})
		const parsed = parseListEnvelope(data, parseSalesOrder, 'sales orders')
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
		return { sales_order: parseSalesOrder(unwrapResource(data)) }
	}

	/** POST /sales_orders */
	async createSalesOrder(input: KatanaCreateSalesOrderInput): Promise<KatanaCreateSalesOrderOutput> {
		const { data } = await this.#http.post('/sales_orders', salesOrderCreateBody(input), {
			label: 'Katana createSalesOrder'
		})
		return { sales_order: parseSalesOrder(unwrapResource(data)) }
	}

	/** PATCH /sales_orders/{id} */
	async updateSalesOrder(input: KatanaUpdateSalesOrderInput): Promise<KatanaUpdateSalesOrderOutput> {
		const { sales_order_id, ...fields } = input
		const { data } = await this.#http.patch(`/sales_orders/${sales_order_id}`, salesOrderUpdateBody(fields), {
			label: 'Katana updateSalesOrder'
		})
		return { sales_order: parseSalesOrder(unwrapResource(data)) }
	}

	/** DELETE /sales_orders/{id} */
	async deleteSalesOrder(input: KatanaDeleteSalesOrderInput): Promise<KatanaDeleteSalesOrderOutput> {
		await this.#http.delete(`/sales_orders/${input.sales_order_id}`, {
			label: 'Katana deleteSalesOrder'
		})
		return { deleted: true, id: input.sales_order_id }
	}

	// ── Products ────────────────────────────────────────────────────────────

	/** GET /products */
	async listProducts(input: KatanaListProductsInput = {}): Promise<KatanaListProductsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/products', {
			label: 'Katana listProducts',
			query: {
				page,
				limit,
				...(input.name && { name: input.name }),
				...(input.is_sellable !== undefined && { is_sellable: input.is_sellable }),
				...(input.is_producible !== undefined && { is_producible: input.is_producible }),
				...(input.is_purchasable !== undefined && { is_purchasable: input.is_purchasable })
			}
		})
		const parsed = parseListEnvelope(data, parseProduct, 'products')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /products/{id} */
	async getProduct(input: KatanaGetProductInput): Promise<KatanaGetProductOutput> {
		const { data } = await this.#http.get(`/products/${input.product_id}`, {
			label: 'Katana getProduct'
		})
		return { product: parseProduct(unwrapResource(data)) }
	}

	/** POST /products */
	async createProduct(input: KatanaCreateProductInput): Promise<KatanaCreateProductOutput> {
		const { data } = await this.#http.post('/products', productCreateBody(input), {
			label: 'Katana createProduct'
		})
		return { product: parseProduct(unwrapResource(data)) }
	}

	/** PATCH /products/{id} */
	async updateProduct(input: KatanaUpdateProductInput): Promise<KatanaUpdateProductOutput> {
		const { product_id, ...fields } = input
		const { data } = await this.#http.patch(`/products/${product_id}`, productUpdateBody(fields), {
			label: 'Katana updateProduct'
		})
		return { product: parseProduct(unwrapResource(data)) }
	}

	// ── Materials ───────────────────────────────────────────────────────────

	/** GET /materials */
	async listMaterials(input: KatanaListMaterialsInput = {}): Promise<KatanaListMaterialsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/materials', {
			label: 'Katana listMaterials',
			query: {
				page,
				limit,
				...(input.name && { name: input.name })
			}
		})
		const parsed = parseListEnvelope(data, parseMaterial, 'materials')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /materials/{id} */
	async getMaterial(input: KatanaGetMaterialInput): Promise<KatanaGetMaterialOutput> {
		const { data } = await this.#http.get(`/materials/${input.material_id}`, {
			label: 'Katana getMaterial'
		})
		return { material: parseMaterial(unwrapResource(data)) }
	}

	// ── Customers ───────────────────────────────────────────────────────────

	/** GET /customers */
	async listCustomers(input: KatanaListCustomersInput = {}): Promise<KatanaListCustomersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/customers', {
			label: 'Katana listCustomers',
			query: {
				page,
				limit,
				...(input.name && { name: input.name }),
				...(input.email && { email: input.email })
			}
		})
		const parsed = parseListEnvelope(data, parseCustomer, 'customers')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /customers/{id} */
	async getCustomer(input: KatanaGetCustomerInput): Promise<KatanaGetCustomerOutput> {
		const { data } = await this.#http.get(`/customers/${input.customer_id}`, {
			label: 'Katana getCustomer'
		})
		return { customer: parseCustomer(unwrapResource(data)) }
	}

	/** POST /customers */
	async createCustomer(input: KatanaCreateCustomerInput): Promise<KatanaCreateCustomerOutput> {
		const { data } = await this.#http.post('/customers', customerWriteBody(input), {
			label: 'Katana createCustomer'
		})
		return { customer: parseCustomer(unwrapResource(data)) }
	}

	/** PATCH /customers/{id} */
	async updateCustomer(input: KatanaUpdateCustomerInput): Promise<KatanaUpdateCustomerOutput> {
		const { customer_id, ...fields } = input
		const { data } = await this.#http.patch(`/customers/${customer_id}`, customerWriteBody(fields), {
			label: 'Katana updateCustomer'
		})
		return { customer: parseCustomer(unwrapResource(data)) }
	}

	// ── Suppliers ───────────────────────────────────────────────────────────

	/** GET /suppliers */
	async listSuppliers(input: KatanaListSuppliersInput = {}): Promise<KatanaListSuppliersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/suppliers', {
			label: 'Katana listSuppliers',
			query: {
				page,
				limit,
				...(input.name && { name: input.name })
			}
		})
		const parsed = parseListEnvelope(data, parseSupplier, 'suppliers')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /suppliers/{id} */
	async getSupplier(input: KatanaGetSupplierInput): Promise<KatanaGetSupplierOutput> {
		const { data } = await this.#http.get(`/suppliers/${input.supplier_id}`, {
			label: 'Katana getSupplier'
		})
		return { supplier: parseSupplier(unwrapResource(data)) }
	}

	/** POST /suppliers */
	async createSupplier(input: KatanaCreateSupplierInput): Promise<KatanaCreateSupplierOutput> {
		const { data } = await this.#http.post('/suppliers', supplierCreateBody(input), {
			label: 'Katana createSupplier'
		})
		return { supplier: parseSupplier(unwrapResource(data)) }
	}

	// ── Purchase orders ─────────────────────────────────────────────────────

	/** GET /purchase_orders */
	async listPurchaseOrders(input: KatanaListPurchaseOrdersInput = {}): Promise<KatanaListPurchaseOrdersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/purchase_orders', {
			label: 'Katana listPurchaseOrders',
			query: {
				page,
				limit,
				...(input.status && { status: input.status }),
				...(input.supplier_id !== undefined && { supplier_id: input.supplier_id }),
				...(input.order_no && { order_no: input.order_no }),
				...(input.location_id !== undefined && { location_id: input.location_id })
			}
		})
		const parsed = parseListEnvelope(data, parsePurchaseOrder, 'purchase orders')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /purchase_orders/{id} */
	async getPurchaseOrder(input: KatanaGetPurchaseOrderInput): Promise<KatanaGetPurchaseOrderOutput> {
		const { data } = await this.#http.get(`/purchase_orders/${input.purchase_order_id}`, {
			label: 'Katana getPurchaseOrder'
		})
		return { purchase_order: parsePurchaseOrder(unwrapResource(data)) }
	}

	/** POST /purchase_orders */
	async createPurchaseOrder(input: KatanaCreatePurchaseOrderInput): Promise<KatanaCreatePurchaseOrderOutput> {
		const { data } = await this.#http.post('/purchase_orders', purchaseOrderCreateBody(input), {
			label: 'Katana createPurchaseOrder'
		})
		return { purchase_order: parsePurchaseOrder(unwrapResource(data)) }
	}

	/** PATCH /purchase_orders/{id} */
	async updatePurchaseOrder(input: KatanaUpdatePurchaseOrderInput): Promise<KatanaUpdatePurchaseOrderOutput> {
		const { purchase_order_id, ...fields } = input
		const { data } = await this.#http.patch(`/purchase_orders/${purchase_order_id}`, purchaseOrderUpdateBody(fields), {
			label: 'Katana updatePurchaseOrder'
		})
		return { purchase_order: parsePurchaseOrder(unwrapResource(data)) }
	}

	// ── Manufacturing orders ────────────────────────────────────────────────

	/** GET /manufacturing_orders */
	async listManufacturingOrders(
		input: KatanaListManufacturingOrdersInput = {}
	): Promise<KatanaListManufacturingOrdersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/manufacturing_orders', {
			label: 'Katana listManufacturingOrders',
			query: {
				page,
				limit,
				...(input.status && { status: input.status }),
				...(input.variant_id !== undefined && { variant_id: input.variant_id }),
				...(input.location_id !== undefined && { location_id: input.location_id }),
				...(input.order_no && { order_no: input.order_no })
			}
		})
		const parsed = parseListEnvelope(data, parseManufacturingOrder, 'manufacturing orders')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /manufacturing_orders/{id} */
	async getManufacturingOrder(input: KatanaGetManufacturingOrderInput): Promise<KatanaGetManufacturingOrderOutput> {
		const { data } = await this.#http.get(`/manufacturing_orders/${input.manufacturing_order_id}`, {
			label: 'Katana getManufacturingOrder'
		})
		return { manufacturing_order: parseManufacturingOrder(unwrapResource(data)) }
	}

	/** POST /manufacturing_orders */
	async createManufacturingOrder(
		input: KatanaCreateManufacturingOrderInput
	): Promise<KatanaCreateManufacturingOrderOutput> {
		const { data } = await this.#http.post('/manufacturing_orders', manufacturingOrderCreateBody(input), {
			label: 'Katana createManufacturingOrder'
		})
		return { manufacturing_order: parseManufacturingOrder(unwrapResource(data)) }
	}

	/** PATCH /manufacturing_orders/{id} */
	async updateManufacturingOrder(
		input: KatanaUpdateManufacturingOrderInput
	): Promise<KatanaUpdateManufacturingOrderOutput> {
		const { manufacturing_order_id, ...fields } = input
		const { data } = await this.#http.patch(
			`/manufacturing_orders/${manufacturing_order_id}`,
			manufacturingOrderUpdateBody(fields),
			{ label: 'Katana updateManufacturingOrder' }
		)
		return { manufacturing_order: parseManufacturingOrder(unwrapResource(data)) }
	}

	// ── Inventory ───────────────────────────────────────────────────────────

	/** GET /inventory */
	async listInventory(input: KatanaListInventoryInput = {}): Promise<KatanaListInventoryOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/inventory', {
			label: 'Katana listInventory',
			query: {
				page,
				limit,
				...(input.variant_id !== undefined && { variant_id: input.variant_id }),
				...(input.location_id !== undefined && { location_id: input.location_id })
			}
		})
		const parsed = parseListEnvelope(data, parseInventory, 'inventory')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}
}
