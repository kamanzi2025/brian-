import Dexie from 'dexie'

// Each table's index string:
//   First item = primary key.
//   Remaining items = indexed columns (prefix & = compound/unique).
//   Non-indexed columns still exist — they just can't be queried efficiently.
//   We index `synced` so we can do db.products.where('synced').equals(0) efficiently,
//   and `updated_at` so we can find records newer than our last pull timestamp.

export const db = new Dexie('autoparts_manager')

const STORES = {
  products:
    'id, name, sku, category, supplier_id, updated_at, synced',

  customers:
    'id, name, phone, updated_at, synced',

  suppliers:
    'id, name, phone, updated_at, synced',

  // customer_id is indexed so we can load all sales for a customer
  sales:
    'id, date, customer_id, payment_method, status, updated_at, synced',

  // sale_id + product_id indexed for joining; no synced field — items
  // are treated as immutable children of a sale (deleted and re-created with sale)
  sale_items:
    'id, sale_id, product_id',

  purchases:
    'id, date, supplier_id, payment_status, updated_at, synced',

  purchase_items:
    'id, purchase_id, product_id',

  expenses:
    'id, date, category, updated_at, synced',

  // direction: 'in' (received) | 'out' (paid)
  payments:
    'id, related_sale_id, related_purchase_id, date, method, direction, updated_at, synced',
}

db.version(1).stores(STORES)

// v2: split quantity_on_hand into qty_warehouse + qty_store
db.version(2).stores(STORES).upgrade((tx) =>
  tx.table('products').toCollection().modify((p) => {
    p.qty_warehouse = p.quantity_on_hand ?? 0
    p.qty_store = 0
    delete p.quantity_on_hand
  })
)

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
