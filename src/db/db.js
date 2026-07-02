import Dexie from 'dexie'

// Each table's index string:
//   First item = primary key.
//   Remaining items = indexed columns (queried efficiently).
//   Non-indexed columns still exist — they just can't be used in where() clauses.

export const db = new Dexie('autoparts_manager')

// ─── Version 1 schema (original) ─────────────────────────────────────────────
const STORES_V1 = {
  products:
    'id, name, sku, category, supplier_id, updated_at, synced',
  customers:
    'id, name, phone, updated_at, synced',
  suppliers:
    'id, name, phone, updated_at, synced',
  sales:
    'id, date, customer_id, payment_method, status, updated_at, synced',
  sale_items:
    'id, sale_id, product_id',
  purchases:
    'id, date, supplier_id, payment_status, updated_at, synced',
  purchase_items:
    'id, purchase_id, product_id',
  expenses:
    'id, date, category, updated_at, synced',
  payments:
    'id, related_sale_id, related_purchase_id, date, method, direction, updated_at, synced',
}

// ─── Version 3 schema ─────────────────────────────────────────────────────────
const STORES_V3 = {
  products:
    'id, name, sku, oem_number, category, supplier_id, active, updated_at, synced',
  customers:
    'id, name, phone, updated_at, synced',
  suppliers:
    'id, name, phone, updated_at, synced',
  sales:
    'id, date, customer_id, payment_method, status, voided, quote_id, updated_at, synced',
  sale_items:
    'id, sale_id, product_id',
  purchases:
    'id, date, supplier_id, payment_status, updated_at, synced',
  purchase_items:
    'id, purchase_id, product_id',
  expenses:
    'id, date, category, updated_at, synced',
  payments:
    'id, related_sale_id, related_purchase_id, date, method, direction, updated_at, synced',
  quotations:
    'id, date, expiry_date, customer_id, status, updated_at, synced',
  quotation_items:
    'id, quotation_id, product_id',
  returns:
    'id, original_sale_id, date, status, updated_at, synced',
  return_items:
    'id, return_id, product_id',
  stock_movements:
    'id, product_id, movement_type, reference_id, created_at, updated_at, synced',
}

// ─── Version 4 schema (current) ───────────────────────────────────────────────
// Adds: supplier_tabs, fixed_expense_config
// Extends: payments (recipient_name, proof_image, rmb_amount, exchange_rate, supplier_id, note)
//          purchases (rmb_total, exchange_rate, deposit_paid, freight_cost, tab_id)
const STORES_V4 = {
  ...STORES_V3,
  // Index supplier_id on payments for per-supplier payment history queries
  payments:
    'id, related_sale_id, related_purchase_id, date, method, direction, supplier_id, updated_at, synced',
  // Supplier tab system: open tab = accumulating purchases; closed = settled
  supplier_tabs:
    'id, supplier_id, status, opened_date, closed_date, updated_at, synced',
  // Single device-local record for fixed monthly expense configuration
  fixed_expense_config:
    '++id',
}

// ─── Version definitions ──────────────────────────────────────────────────────

db.version(1).stores(STORES_V1)

db.version(2).stores(STORES_V1).upgrade((tx) =>
  tx.table('products').toCollection().modify((p) => {
    p.qty_warehouse = p.quantity_on_hand ?? 0
    p.qty_store = 0
    delete p.quantity_on_hand
  })
)

db.version(3).stores(STORES_V3).upgrade(async (tx) => {
  await tx.table('products').toCollection().modify((p) => {
    if (p.active          === undefined) p.active          = 1
    if (p.wholesale_price === undefined) p.wholesale_price = p.selling_price ?? 0
    if (p.oem_number      === undefined) p.oem_number      = null
    if (p.warranty_months === undefined) p.warranty_months = 0
    if (p.barcode         === undefined) p.barcode         = null
    if (p.vehicle_makes   === undefined) p.vehicle_makes   = null
    if (p.vehicle_models  === undefined) p.vehicle_models  = null
    if (p.year_from       === undefined) p.year_from       = null
    if (p.year_to         === undefined) p.year_to         = null
  })
  await tx.table('sales').toCollection().modify((s) => {
    if (s.subtotal    === undefined) s.subtotal    = s.total ?? 0
    if (s.vat_amount  === undefined) s.vat_amount  = 0
    if (s.voided      === undefined) s.voided      = 0
    if (s.void_reason === undefined) s.void_reason = null
    if (s.voided_at   === undefined) s.voided_at   = null
    if (s.quote_id    === undefined) s.quote_id    = null
  })
  await tx.table('sale_items').toCollection().modify((item) => {
    if (item.cost_price === undefined) item.cost_price = 0
  })
  await tx.table('suppliers').toCollection().modify((s) => {
    if (s.email         === undefined) s.email         = null
    if (s.address       === undefined) s.address       = null
    if (s.payment_terms === undefined) s.payment_terms = null
    if (s.notes         === undefined) s.notes         = null
  })
})

db.version(4).stores(STORES_V4).upgrade(async (tx) => {
  // purchases: new fields for China import workflow
  await tx.table('purchases').toCollection().modify((p) => {
    if (p.rmb_total     === undefined) p.rmb_total     = null
    if (p.exchange_rate === undefined) p.exchange_rate = null
    if (p.deposit_paid  === undefined) p.deposit_paid  = 0
    if (p.freight_cost  === undefined) p.freight_cost  = 0
    if (p.tab_id        === undefined) p.tab_id        = null
  })
  // purchase_items: freight and tax per line item
  await tx.table('purchase_items').toCollection().modify((item) => {
    if (item.freight_cost  === undefined) item.freight_cost  = 0
    if (item.tax_per_item  === undefined) item.tax_per_item  = 0
    if (item.rmb_unit_cost === undefined) item.rmb_unit_cost = null
  })
  // payments: extended fields for supplier payment tracking
  await tx.table('payments').toCollection().modify((p) => {
    if (p.recipient_name === undefined) p.recipient_name = null
    if (p.proof_image    === undefined) p.proof_image    = null
    if (p.rmb_amount     === undefined) p.rmb_amount     = null
    if (p.exchange_rate  === undefined) p.exchange_rate  = null
    if (p.supplier_id    === undefined) p.supplier_id    = null
    if (p.note           === undefined) p.note           = null
  })
  // sales: salesman name and delivery address on receipt
  await tx.table('sales').toCollection().modify((s) => {
    if (s.salesman_name    === undefined) s.salesman_name    = null
    if (s.delivery_address === undefined) s.delivery_address = null
  })
})

// ─── Convenience helpers ─────────────────────────────────────────────────────

export function getUnsynced(table) {
  return db[table].where('synced').equals(0).toArray()
}

export async function markSynced(table, ids) {
  await db[table].where('id').anyOf(ids).modify({ synced: 1 })
}

export async function upsertLocal(table, records) {
  await db[table].bulkPut(records)
}
