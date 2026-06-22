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

// ─── Version 3 schema (current) ──────────────────────────────────────────────
// New indexes on existing tables + five new tables.
const STORES_V3 = {
  // Extended: oem_number, active indexed for catalogue queries
  products:
    'id, name, sku, oem_number, category, supplier_id, active, updated_at, synced',

  customers:
    'id, name, phone, updated_at, synced',

  // Extended fields stored but not indexed (email, address, payment_terms, notes)
  suppliers:
    'id, name, phone, updated_at, synced',

  // Extended: voided indexed to exclude voided sales from reports; quote_id for traceability
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

  // ── New tables ──────────────────────────────────────────────────────────────
  quotations:
    'id, date, expiry_date, customer_id, status, updated_at, synced',

  quotation_items:
    'id, quotation_id, product_id',

  returns:
    'id, original_sale_id, date, status, updated_at, synced',

  return_items:
    'id, return_id, product_id',

  // Append-only movement log — synced like a regular table via updated_at + synced flag
  stock_movements:
    'id, product_id, movement_type, reference_id, created_at, updated_at, synced',
}

// ─── Version definitions ──────────────────────────────────────────────────────

db.version(1).stores(STORES_V1)

// v2: split quantity_on_hand → qty_warehouse + qty_store
db.version(2).stores(STORES_V1).upgrade((tx) =>
  tx.table('products').toCollection().modify((p) => {
    p.qty_warehouse = p.quantity_on_hand ?? 0
    p.qty_store = 0
    delete p.quantity_on_hand
  })
)

// v3: add new columns to existing tables + five new tables
db.version(3).stores(STORES_V3).upgrade(async (tx) => {
  // products: extended catalogue fields
  await tx.table('products').toCollection().modify((p) => {
    if (p.active        === undefined) p.active          = 1
    if (p.wholesale_price === undefined) p.wholesale_price = p.selling_price ?? 0
    if (p.oem_number    === undefined) p.oem_number      = null
    if (p.warranty_months === undefined) p.warranty_months = 0
    if (p.barcode       === undefined) p.barcode         = null
    if (p.vehicle_makes  === undefined) p.vehicle_makes   = null
    if (p.vehicle_models === undefined) p.vehicle_models  = null
    if (p.year_from     === undefined) p.year_from       = null
    if (p.year_to       === undefined) p.year_to         = null
  })

  // sales: VAT breakdown + void support + quote reference
  await tx.table('sales').toCollection().modify((s) => {
    if (s.subtotal    === undefined) s.subtotal    = s.total ?? 0
    if (s.vat_amount  === undefined) s.vat_amount  = 0
    if (s.voided      === undefined) s.voided      = 0
    if (s.void_reason === undefined) s.void_reason = null
    if (s.voided_at   === undefined) s.voided_at   = null
    if (s.quote_id    === undefined) s.quote_id    = null
  })

  // sale_items: cost at time of sale (old records get 0; reports fall back to product cost)
  await tx.table('sale_items').toCollection().modify((item) => {
    if (item.cost_price === undefined) item.cost_price = 0
  })

  // suppliers: extended profile fields
  await tx.table('suppliers').toCollection().modify((s) => {
    if (s.email         === undefined) s.email         = null
    if (s.address       === undefined) s.address       = null
    if (s.payment_terms === undefined) s.payment_terms = null
    if (s.notes         === undefined) s.notes         = null
  })
})

// ─── Convenience helpers ─────────────────────────────────────────────────────

/** Return all records in a table that haven't been pushed to Supabase yet. */
export function getUnsynced(table) {
  return db[table].where('synced').equals(0).toArray()
}

/** Mark a list of records as synced by their ids. */
export async function markSynced(table, ids) {
  await db[table].where('id').anyOf(ids).modify({ synced: 1 })
}

/** Upsert (put) an array of records into a local table. */
export async function upsertLocal(table, records) {
  await db[table].bulkPut(records)
}
