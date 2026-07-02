/**
 * DATABASE OPERATIONS — all complex writes that touch multiple tables.
 *
 * Every exported function uses a Dexie transaction so the entire operation is
 * atomic: if any step fails, all changes are rolled back in IndexedDB.
 *
 * All records written here get synced = 0 so the sync engine picks them up.
 */

import { db } from './db'
import { nowIso, today, newId } from '../utils/format'

// ─── Private helper: decrement stock + log the movement ──────────────────────
// Called inside an existing transaction. Captures qty_before atomically via
// the modify() callback, then inserts a stock_movements row.
async function deductStockAndLog(productId, quantity, referenceId, referenceType, note) {
  let movement = null
  const ts = nowIso()

  await db.products.where('id').equals(productId).modify((p) => {
    const qtyBefore = (p.qty_store || 0) + (p.qty_warehouse || 0)
    const qtyAfter = qtyBefore - quantity

    // Sales always deduct from store. Transfer warehouse→store first if needed.
    p.qty_store = (p.qty_store || 0) - quantity
    p.updated_at = ts
    p.synced = 0

    movement = {
      id: newId(),
      product_id: productId,
      movement_type: referenceType,
      qty_change: -quantity,
      qty_before: qtyBefore,
      qty_after: qtyAfter,
      location: 'store',
      reference_id: referenceId,
      reference_type: referenceType,
      note: note ?? null,
      created_at: ts,
      updated_at: ts,
      synced: 0,
    }
  })

  if (movement) {
    await db.stock_movements.put(movement)
  }
}

// ─── Private helper: increment stock + log the movement ──────────────────────
async function addStockAndLog(productId, quantity, location, referenceId, referenceType, note) {
  let movement = null
  const ts = nowIso()

  await db.products.where('id').equals(productId).modify((p) => {
    const qtyBefore = (p.qty_store || 0) + (p.qty_warehouse || 0)
    const qtyAfter = qtyBefore + quantity

    if (location === 'store') {
      p.qty_store = (p.qty_store || 0) + quantity
    } else {
      p.qty_warehouse = (p.qty_warehouse || 0) + quantity
    }
    p.updated_at = ts
    p.synced = 0

    movement = {
      id: newId(),
      product_id: productId,
      movement_type: referenceType,
      qty_change: +quantity,
      qty_before: qtyBefore,
      qty_after: qtyAfter,
      location,
      reference_id: referenceId,
      reference_type: referenceType,
      note: note ?? null,
      created_at: ts,
      updated_at: ts,
      synced: 0,
    }
  })

  if (movement) {
    await db.stock_movements.put(movement)
  }
}

// ─── SAVE SALE ────────────────────────────────────────────────────────────────
// Creates sale + line items, decrements stock (store first then warehouse),
// logs stock movements, and increases customer balance_owed on credit sales.
export async function saveSale({ sale, items }) {
  // Validate store stock before opening the transaction
  for (const item of items) {
    const product = await db.products.get(item.product_id)
    if (!product) throw new Error('Product not found.')
    if ((product.qty_store ?? 0) < item.quantity) {
      throw new Error(
        `Not enough store stock for "${product.name}". ` +
        `Store has ${product.qty_store ?? 0} unit(s), sale needs ${item.quantity}.`
      )
    }
  }

  await db.transaction(
    'rw',
    [db.sales, db.sale_items, db.products, db.customers, db.stock_movements],
    async () => {
      await db.sales.put(sale)
      await db.sale_items.bulkPut(items)

      for (const item of items) {
        await deductStockAndLog(
          item.product_id,
          item.quantity,
          sale.id,
          'sale',
          null
        )
      }

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

// ─── VOID SALE ────────────────────────────────────────────────────────────────
// Marks sale as voided, reverses stock, reverses customer credit balance.
// Voided records are NEVER deleted — they remain in the DB for the audit trail.
export async function voidSale(saleId, reason) {
  const sale = await db.sales.get(saleId)
  if (!sale) throw new Error('Sale not found.')
  if (sale.voided) throw new Error('Sale is already voided.')

  const items = await db.sale_items.where('sale_id').equals(saleId).toArray()
  const ts = nowIso()

  await db.transaction(
    'rw',
    [db.sales, db.sale_items, db.products, db.customers, db.stock_movements],
    async () => {
      // Mark the sale
      await db.sales.update(saleId, {
        voided: 1,
        void_reason: reason,
        voided_at: ts,
        updated_at: ts,
        synced: 0,
      })

      // Reverse stock: add back to store (where it was sold from)
      for (const item of items) {
        await addStockAndLog(
          item.product_id,
          item.quantity,
          'store',
          saleId,
          'void_reversal',
          `Void: ${reason}`
        )
      }

      // Reverse customer balance if it was a credit sale
      if (sale.payment_method === 'credit' && sale.customer_id) {
        await db.customers
          .where('id')
          .equals(sale.customer_id)
          .modify((c) => {
            c.balance_owed = Math.max(0, +(c.balance_owed || 0) - +sale.total)
            c.updated_at = ts
            c.synced = 0
          })
      }
    }
  )
}

// ─── SAVE PURCHASE ────────────────────────────────────────────────────────────
// Creates purchase + items, increases warehouse stock, logs movements,
// updates cost_price, and increases supplier balance_owed if unpaid.
export async function savePurchase({ purchase, items }) {
  await db.transaction(
    'rw',
    [db.purchases, db.purchase_items, db.products, db.suppliers, db.stock_movements],
    async () => {
      await db.purchases.put(purchase)
      await db.purchase_items.bulkPut(items)

      for (const item of items) {
        await addStockAndLog(
          item.product_id,
          item.quantity,
          'warehouse',
          purchase.id,
          'purchase',
          null
        )
        // Update cost_price to the latest purchase price so margins stay current
        await db.products
          .where('id')
          .equals(item.product_id)
          .modify((p) => {
            p.cost_price = item.unit_cost
            p.updated_at = nowIso()
            p.synced = 0
          })
      }

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
//   direction='in'  → received from customer  → reduce customer.balance_owed
//   direction='out' → paid to supplier         → reduce supplier.balance_owed
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

// ─── SUPPLIER TABS ────────────────────────────────────────────────────────────

export async function openSupplierTab(supplierId) {
  const existing = await db.supplier_tabs
    .where('supplier_id').equals(supplierId)
    .filter((t) => t.status === 'open')
    .first()
  if (existing) throw new Error('Supplier already has an open tab.')

  const tab = {
    id: newId(),
    supplier_id: supplierId,
    status: 'open',
    opened_date: today(),
    closed_date: null,
    total_purchases: 0,
    total_paid: 0,
    updated_at: nowIso(),
    synced: 0,
  }
  await db.supplier_tabs.put(tab)
  return tab
}

export async function closeSupplierTab(tabId) {
  const tab = await db.supplier_tabs.get(tabId)
  if (!tab) throw new Error('Tab not found.')
  if (tab.status === 'closed') throw new Error('Tab is already closed.')

  await db.supplier_tabs.update(tabId, {
    status: 'closed',
    closed_date: today(),
    updated_at: nowIso(),
    synced: 0,
  })
}

// ─── SAVE QUOTATION ───────────────────────────────────────────────────────────
// Atomic write of a quotation and its line items. No stock change.
export async function saveQuotation({ quotation, items }) {
  await db.transaction(
    'rw',
    [db.quotations, db.quotation_items],
    async () => {
      await db.quotations.put(quotation)
      await db.quotation_items.bulkPut(items)
    }
  )
}

// ─── CONVERT QUOTATION TO SALE ────────────────────────────────────────────────
// Creates a full sale from a quote, marks the quote as converted, decrements
// stock, and returns the new sale's id.
export async function convertQuotationToSale(quotationId, { paymentMethod = 'cash' } = {}) {
  const quotation = await db.quotations.get(quotationId)
  if (!quotation) throw new Error('Quotation not found.')
  if (quotation.status === 'converted') throw new Error('Quotation already converted.')

  const qItems = await db.quotation_items
    .where('quotation_id')
    .equals(quotationId)
    .toArray()

  // Look up current cost_price for each product (at conversion time)
  const productIds = [...new Set(qItems.map((i) => i.product_id).filter(Boolean))]
  const products =
    productIds.length > 0
      ? await db.products.where('id').anyOf(productIds).toArray()
      : []
  const pMap = new Map(products.map((p) => [p.id, p]))

  // Validate store stock before converting
  for (const item of qItems) {
    const product = pMap.get(item.product_id)
    if (!product) throw new Error('Product not found.')
    if ((product.qty_store ?? 0) < item.quantity) {
      throw new Error(
        `Not enough store stock for "${product.name}". ` +
        `Store has ${product.qty_store ?? 0} unit(s), quote needs ${item.quantity}.`
      )
    }
  }

  const saleId = newId()
  const ts = nowIso()

  const sale = {
    id: saleId,
    date: today(),
    customer_id: quotation.customer_id ?? null,
    payment_method: paymentMethod,
    status: 'completed',
    subtotal: quotation.subtotal,
    vat_amount: quotation.vat_amount,
    total: quotation.total,
    quote_id: quotationId,
    voided: 0,
    void_reason: null,
    voided_at: null,
    updated_at: ts,
    synced: 0,
  }

  const saleItems = qItems.map((item) => ({
    id: newId(),
    sale_id: saleId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    cost_price: pMap.get(item.product_id)?.cost_price ?? 0,
    subtotal: item.subtotal,
  }))

  await db.transaction(
    'rw',
    [db.sales, db.sale_items, db.products, db.customers, db.stock_movements, db.quotations],
    async () => {
      await db.sales.put(sale)
      await db.sale_items.bulkPut(saleItems)

      for (const item of saleItems) {
        await deductStockAndLog(
          item.product_id,
          item.quantity,
          saleId,
          'sale',
          `Converted from quote ${quotationId}`
        )
      }

      if (paymentMethod === 'credit' && sale.customer_id) {
        await db.customers
          .where('id')
          .equals(sale.customer_id)
          .modify((c) => {
            c.balance_owed = +(c.balance_owed || 0) + +sale.total
            c.updated_at = ts
            c.synced = 0
          })
      }

      await db.quotations.update(quotationId, {
        status: 'converted',
        converted_sale_id: saleId,
        updated_at: ts,
        synced: 0,
      })
    }
  )

  return saleId
}

// ─── SAVE RETURN ──────────────────────────────────────────────────────────────
// Creates a return record + line items, restocks qty_store, logs movements,
// and reduces the original customer's credit balance (if the sale was on credit).
export async function saveReturn({ return_, items }) {
  // Look up the original sale to know if it was credit
  const originalSale = return_.original_sale_id
    ? await db.sales.get(return_.original_sale_id)
    : null

  await db.transaction(
    'rw',
    [db.returns, db.return_items, db.products, db.customers, db.stock_movements],
    async () => {
      await db.returns.put(return_)
      await db.return_items.bulkPut(items)

      for (const item of items) {
        await addStockAndLog(
          item.product_id,
          item.quantity,
          'store',
          return_.id,
          'return',
          `Return: ${return_.reason}`
        )
      }

      // If the original was a credit sale, reduce the customer's balance
      if (
        originalSale?.payment_method === 'credit' &&
        originalSale?.customer_id
      ) {
        await db.customers
          .where('id')
          .equals(originalSale.customer_id)
          .modify((c) => {
            c.balance_owed = Math.max(0, +(c.balance_owed || 0) - +return_.total)
            c.updated_at = nowIso()
            c.synced = 0
          })
      }
    }
  )
}

// ─── TRANSFER STOCK ───────────────────────────────────────────────────────────
// Moves qty units from warehouse to store. Validates sufficient warehouse stock.
export async function transferStock({ productId, qty, note }) {
  const product = await db.products.get(productId)
  if (!product) throw new Error('Product not found.')
  if ((product.qty_warehouse || 0) < qty) {
    throw new Error(
      `Only ${product.qty_warehouse ?? 0} units in warehouse — cannot transfer ${qty}.`
    )
  }

  const transferId = newId()
  const ts = nowIso()

  await db.transaction(
    'rw',
    [db.products, db.stock_movements],
    async () => {
      const qtyBefore = (product.qty_warehouse || 0) + (product.qty_store || 0)

      // Deduct from warehouse
      await db.products
        .where('id')
        .equals(productId)
        .modify((p) => {
          p.qty_warehouse = (p.qty_warehouse || 0) - qty
          p.qty_store = (p.qty_store || 0) + qty
          p.updated_at = ts
          p.synced = 0
        })

      // Log warehouse → out
      await db.stock_movements.put({
        id: newId(),
        product_id: productId,
        movement_type: 'transfer_out',
        qty_change: -qty,
        qty_before: qtyBefore,
        qty_after: qtyBefore,   // total unchanged — only location changed
        location: 'warehouse',
        reference_id: transferId,
        reference_type: 'transfer',
        note: note ?? null,
        created_at: ts,
        updated_at: ts,
        synced: 0,
      })

      // Log store → in
      await db.stock_movements.put({
        id: newId(),
        product_id: productId,
        movement_type: 'transfer_in',
        qty_change: +qty,
        qty_before: qtyBefore,
        qty_after: qtyBefore,   // total unchanged
        location: 'store',
        reference_id: transferId,
        reference_type: 'transfer',
        note: note ?? null,
        created_at: ts,
        updated_at: ts,
        synced: 0,
      })
    }
  )
}
