/**
 * DATABASE OPERATIONS — all complex writes that touch multiple tables.
 *
 * Every function uses a Dexie transaction so the entire operation is
 * atomic: if any step fails, all changes are rolled back in IndexedDB.
 * This prevents inconsistent state (e.g. a sale saved but stock not decremented).
 *
 * All records written here get synced = 0 so the sync engine picks them up.
 */

import { db } from './db'
import { nowIso } from '../utils/format'

// ─── SAVE SALE ────────────────────────────────────────────────────────────────
// Creates the sale + its line items, decrements stock, and (if on credit)
// increases the customer's balance_owed.
export async function saveSale({ sale, items }) {
  await db.transaction(
    'rw',
    [db.sales, db.sale_items, db.products, db.customers],
    async () => {
      await db.sales.put(sale)
      await db.sale_items.bulkPut(items)

      for (const item of items) {
        await db.products
          .where('id')
          .equals(item.product_id)
          .modify((p) => {
            p.qty_store = Math.max(0, (p.qty_store || 0) - item.quantity)
            p.updated_at = nowIso()
            p.synced = 0
          })
      }

      // Only increase customer debt when the sale is explicitly on credit
      if (sale.payment_method === 'credit' && sale.customer_id) {
        await db.customers
          .where('id')
          .equals(sale.customer_id)
          .modify((c) => {
            c.balance_owed = +(c.balance_owed || 0) + +sale.total
            c.updated_at = nowIso()
            c.synced = 0
          })
      }
    }
  )
}

// ─── SAVE PURCHASE ────────────────────────────────────────────────────────────
// Creates the purchase + items, increases stock levels, updates cost_price to
// the latest purchase price, and (if unpaid) increases the supplier's balance_owed.
export async function savePurchase({ purchase, items }) {
  await db.transaction(
    'rw',
    [db.purchases, db.purchase_items, db.products, db.suppliers],
    async () => {
      await db.purchases.put(purchase)
      await db.purchase_items.bulkPut(items)

      for (const item of items) {
        await db.products
          .where('id')
          .equals(item.product_id)
          .modify((p) => {
            p.qty_warehouse = (p.qty_warehouse || 0) + item.quantity
            // Update cost_price to the most recent purchase cost so margins stay current
            p.cost_price = item.unit_cost
            p.updated_at = nowIso()
            p.synced = 0
          })
      }

      // Only add to supplier balance if we haven't paid yet
      if (purchase.payment_status === 'unpaid' && purchase.supplier_id) {
        await db.suppliers
          .where('id')
          .equals(purchase.supplier_id)
          .modify((s) => {
            s.balance_owed = +(s.balance_owed || 0) + +purchase.total
            s.updated_at = nowIso()
            s.synced = 0
          })
      }
    }
  )
}

// ─── SAVE PAYMENT ─────────────────────────────────────────────────────────────
// Records a payment and adjusts the relevant balance.
//   direction='in'  → money received from a customer  → reduce customer.balance_owed
//   direction='out' → money paid to a supplier         → reduce supplier.balance_owed
//
// customerId / supplierId are passed explicitly because the payment schema
// doesn't store them directly — the balance update happens in the same transaction.
export async function savePayment({ payment, customerId, supplierId }) {
  await db.transaction(
    'rw',
    [db.payments, db.customers, db.suppliers],
    async () => {
      await db.payments.put(payment)

      if (payment.direction === 'in' && customerId) {
        await db.customers
          .where('id')
          .equals(customerId)
          .modify((c) => {
            c.balance_owed = Math.max(0, +(c.balance_owed || 0) - +payment.amount)
            c.updated_at = nowIso()
            c.synced = 0
          })
      }

      if (payment.direction === 'out' && supplierId) {
        await db.suppliers
          .where('id')
          .equals(supplierId)
          .modify((s) => {
            s.balance_owed = Math.max(0, +(s.balance_owed || 0) - +payment.amount)
            s.updated_at = nowIso()
            s.synced = 0
          })
      }
    }
  )
}
