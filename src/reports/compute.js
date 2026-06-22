/**
 * REPORTING COMPUTE FUNCTIONS
 * ────────────────────────────────────────────────────────────────────────────
 * Every function queries Dexie directly — no pre-calculated totals.
 * These are designed to be called from useLiveQuery() so the UI re-derives
 * automatically when the underlying tables change (e.g. a new sale is posted).
 *
 * IMPORTANT: Guard every anyOf([]) call — Dexie v4 anyOf([]) returns 0 rows
 * (safe), but it's clearer to short-circuit explicitly.
 *
 * Dates are stored and compared as 'YYYY-MM-DD' strings.
 * Lexicographic ordering is identical to chronological order for this format,
 * so Dexie's .between() index scan works correctly.
 */

import { db } from '../db/db'

// ─── PROFIT & LOSS ────────────────────────────────────────────────────────────

/**
 * Overall P&L summary for a date range.
 * COGS uses the product's CURRENT cost_price as an approximation
 * (cost at time of sale is not stored in sale_items).
 */
export async function computePL({ from, to }) {
  const sales = await db.sales
    .where('date').between(from, to, true, true)
    .filter((s) => !s.voided && s.status !== 'cancelled')
    .toArray()

  const revenue = sales.reduce((s, r) => s + (r.total ?? 0), 0)

  let cogs = 0
  if (sales.length > 0) {
    const saleIds = sales.map((s) => s.id)
    const items = await db.sale_items.where('sale_id').anyOf(saleIds).toArray()

    // Build product map as fallback for old records where cost_price=0 on the item
    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))]
    const products =
      productIds.length > 0
        ? await db.products.where('id').anyOf(productIds).toArray()
        : []
    const pMap = new Map(products.map((p) => [p.id, p]))

    cogs = items.reduce((s, i) => {
      // Prefer cost recorded at sale time; fall back to current product cost
      const cost = (i.cost_price && i.cost_price > 0)
        ? i.cost_price
        : (pMap.get(i.product_id)?.cost_price ?? 0)
      return s + i.quantity * cost
    }, 0)
  }

  const expenses = await db.expenses
    .where('date').between(from, to, true, true)
    .toArray()

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  const expenseByCategory = expenses.reduce((acc, e) => {
    const cat = e.category || 'Other'
    acc[cat] = (acc[cat] || 0) + (e.amount ?? 0)
    return acc
  }, {})

  const grossProfit = revenue - cogs
  const netProfit = grossProfit - totalExpenses

  return {
    revenue,
    cogs,
    grossProfit,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    expenses: totalExpenses,
    expenseByCategory,
    netProfit,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    saleCount: sales.length,
  }
}

/**
 * Per-month breakdown for the trend chart.
 * Fetches all data once then partitions in memory to avoid N×3 DB round trips.
 */
export async function computePLMonthly({ from, to }) {
  const allSales = await db.sales
    .where('date').between(from, to, true, true)
    .filter((s) => !s.voided && s.status !== 'cancelled')
    .toArray()

  const saleMap = new Map(allSales.map((s) => [s.id, s]))

  const allItems =
    allSales.length > 0
      ? await db.sale_items.where('sale_id').anyOf(allSales.map((s) => s.id)).toArray()
      : []

  const productIds = [...new Set(allItems.map((i) => i.product_id).filter(Boolean))]
  const products =
    productIds.length > 0
      ? await db.products.where('id').anyOf(productIds).toArray()
      : []
  const pMap = new Map(products.map((p) => [p.id, p]))

  const allExpenses = await db.expenses
    .where('date').between(from, to, true, true)
    .toArray()

  // Aggregate into YYYY-MM buckets
  const months = {}
  const ensure = (key) => {
    if (!months[key]) months[key] = { revenue: 0, cogs: 0, expenses: 0 }
  }

  for (const sale of allSales) {
    const k = sale.date.slice(0, 7)
    ensure(k)
    months[k].revenue += sale.total ?? 0
  }
  for (const item of allItems) {
    const sale = saleMap.get(item.sale_id)
    if (!sale) continue
    const k = sale.date.slice(0, 7)
    ensure(k)
    const cost = (item.cost_price && item.cost_price > 0)
      ? item.cost_price
      : (pMap.get(item.product_id)?.cost_price ?? 0)
    months[k].cogs += item.quantity * cost
  }
  for (const e of allExpenses) {
    const k = e.date.slice(0, 7)
    ensure(k)
    months[k].expenses += e.amount ?? 0
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => ({
      key,
      label: new Date(key + '-01T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
      revenue: d.revenue,
      cogs: d.cogs,
      expenses: d.expenses,
      grossProfit: d.revenue - d.cogs,
      netProfit: d.revenue - d.cogs - d.expenses,
    }))
}

// ─── BALANCE SHEET ────────────────────────────────────────────────────────────

/**
 * Point-in-time snapshot. No date filter — always shows current state.
 *
 * Cash on Hand is estimated from recorded transactions:
 *   + Cash/card/mobile sales (collected at point of sale)
 *   + Payments direction='in' (credit collected from customers)
 *   − Payments direction='out' (paid to suppliers)
 *   − Expenses (cash outflows)
 *   − Purchases marked 'paid' (cash used to buy stock)
 *
 * Note: physical cash not entered into the system won't appear here.
 */
export async function computeBalanceSheet() {
  const [allSales, allPayments, allExpenses, allPurchases, allProducts, allCustomers, allSuppliers] =
    await Promise.all([
      db.sales.filter((s) => s.status !== 'cancelled').toArray(),
      db.payments.toArray(),
      db.expenses.toArray(),
      db.purchases.toArray(),
      db.products.toArray(),
      db.customers.toArray(),
      db.suppliers.toArray(),
    ])

  const cashSales = allSales
    .filter((s) => ['cash', 'mobile_money', 'card'].includes(s.payment_method))
    .reduce((s, r) => s + (r.total ?? 0), 0)

  const paymentsIn = allPayments
    .filter((p) => p.direction === 'in')
    .reduce((s, p) => s + (p.amount ?? 0), 0)

  const paymentsOut = allPayments
    .filter((p) => p.direction === 'out')
    .reduce((s, p) => s + (p.amount ?? 0), 0)

  const totalExpenses = allExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  const paidPurchases = allPurchases
    .filter((p) => p.payment_status === 'paid')
    .reduce((s, p) => s + (p.total ?? 0), 0)

  const cashOnHand = cashSales + paymentsIn - paymentsOut - totalExpenses - paidPurchases

  const inventoryValue = allProducts.reduce(
    (s, p) => s + ((p.qty_warehouse ?? 0) + (p.qty_store ?? 0)) * (p.cost_price ?? 0),
    0
  )

  const accountsReceivable = allCustomers.reduce((s, c) => s + (c.balance_owed ?? 0), 0)

  const totalAssets = cashOnHand + inventoryValue + accountsReceivable
  const accountsPayable = allSuppliers.reduce((s, sup) => s + (sup.balance_owed ?? 0), 0)
  const equity = totalAssets - accountsPayable

  return {
    assets: { cashOnHand, inventoryValue, accountsReceivable, total: totalAssets },
    liabilities: { accountsPayable, total: accountsPayable },
    equity,
  }
}

// ─── CASH FLOW ────────────────────────────────────────────────────────────────

export async function computeCashFlow({ from, to }) {
  const [sales, payments, expenses] = await Promise.all([
    db.sales
      .where('date').between(from, to, true, true)
      .filter((s) => s.status !== 'cancelled')
      .toArray(),
    db.payments.where('date').between(from, to, true, true).toArray(),
    db.expenses.where('date').between(from, to, true, true).toArray(),
  ])

  // Cash-method sales = immediate cash in
  const rows = [
    ...sales
      .filter((s) => s.payment_method !== 'credit')
      .map((s) => ({
        date: s.date,
        direction: 'in',
        amount: s.total ?? 0,
        label: `Sale · ${s.payment_method}`,
      })),
    ...payments.map((p) => ({
      date: p.date,
      direction: p.direction,
      amount: p.amount ?? 0,
      label: p.direction === 'in' ? `Credit collected · ${p.method}` : `Paid to supplier · ${p.method}`,
    })),
    ...expenses.map((e) => ({
      date: e.date,
      direction: 'out',
      amount: e.amount ?? 0,
      label: `Expense · ${e.category || 'Other'}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const totalIn = rows.filter((r) => r.direction === 'in').reduce((s, r) => s + r.amount, 0)
  const totalOut = rows.filter((r) => r.direction === 'out').reduce((s, r) => s + r.amount, 0)

  // Group by week for the bar chart
  const weekMap = {}
  for (const row of rows) {
    const wk = weekStart(row.date)
    if (!weekMap[wk]) weekMap[wk] = { in: 0, out: 0 }
    weekMap[wk][row.direction] += row.amount
  }

  const weeklyData = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, d]) => ({
      label: new Date(wk + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      in: d.in,
      out: d.out,
    }))

  return { rows, weeklyData, totalIn, totalOut, netFlow: totalIn - totalOut }
}

function weekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const diff = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────

export async function computeInventory() {
  const [products, allItems, recentSales] = await Promise.all([
    db.products.orderBy('name').toArray(),
    db.sale_items.toArray(),
    db.sales
      .where('date').aboveOrEqual(nDaysAgo(60))
      .filter((s) => s.status !== 'cancelled')
      .toArray(),
  ])

  const recentSaleIds = new Set(recentSales.map((s) => s.id))
  const recentProductIds = new Set(
    allItems.filter((i) => recentSaleIds.has(i.sale_id)).map((i) => i.product_id)
  )

  // Last sale date per product (for display)
  // Build a map: product_id → [sale dates]
  // We need all sales for this, which is potentially a lot.
  // For a small shop (< 10k items), loading all is fine.
  const allSales = await db.sales.toArray()
  const saleDateById = new Map(allSales.map((s) => [s.id, s.date]))

  const lastSoldMap = {}
  for (const item of allItems) {
    const date = saleDateById.get(item.sale_id)
    if (!date) continue
    if (!lastSoldMap[item.product_id] || date > lastSoldMap[item.product_id]) {
      lastSoldMap[item.product_id] = date
    }
  }

  const rows = products.map((p) => ({
    ...p,
    qty_total: (p.qty_warehouse ?? 0) + (p.qty_store ?? 0),
    stockValue: ((p.qty_warehouse ?? 0) + (p.qty_store ?? 0)) * (p.cost_price ?? 0),
    lastSoldDate: lastSoldMap[p.id] ?? null,
    isSlowMover: !recentProductIds.has(p.id),
    isOutOfStock: (p.qty_warehouse ?? 0) + (p.qty_store ?? 0) === 0,
    isLowStock:
      (p.reorder_level ?? 0) > 0 &&
      (p.qty_warehouse ?? 0) + (p.qty_store ?? 0) <= (p.reorder_level ?? 0),
  }))

  return {
    rows,
    totalValue: rows.reduce((s, p) => s + p.stockValue, 0),
    totalProducts: products.length,
    slowMovers: rows.filter((p) => p.isSlowMover && !p.isOutOfStock).length,
    outOfStock: rows.filter((p) => p.isOutOfStock).length,
    lowStock: rows.filter((p) => p.isLowStock && !p.isOutOfStock).length,
  }
}

// ─── AR AGING ─────────────────────────────────────────────────────────────────

/**
 * Ages each customer's outstanding balance by their oldest unpaid credit sale.
 * Buckets: 0–30, 31–60, 61–90, 90+ days.
 */
export async function computeARAging() {
  const customers = await db.customers.filter((c) => (c.balance_owed ?? 0) > 0).toArray()
  if (customers.length === 0) return { rows: [], buckets: emptyBuckets(), total: 0 }

  const customerIds = customers.map((c) => c.id)
  const creditSales = await db.sales
    .where('customer_id').anyOf(customerIds)
    .filter((s) => s.payment_method === 'credit' && s.status !== 'cancelled')
    .toArray()

  creditSales.sort((a, b) => a.date.localeCompare(b.date))

  // Oldest unpaid credit sale date per customer
  const oldestByCustomer = {}
  for (const s of creditSales) {
    if (!oldestByCustomer[s.customer_id]) oldestByCustomer[s.customer_id] = s.date
  }

  const today = new Date().toISOString().split('T')[0]
  const rows = customers
    .map((c) => {
      const oldest = oldestByCustomer[c.id]
      const days = oldest ? daysBetween(oldest, today) : 999
      return { ...c, oldestSaleDate: oldest ?? null, daysOutstanding: days, bucket: bucket(days) }
    })
    .sort((a, b) => b.daysOutstanding - a.daysOutstanding)

  return {
    rows,
    buckets: aggregateBuckets(rows, 'balance_owed'),
    total: customers.reduce((s, c) => s + (c.balance_owed ?? 0), 0),
  }
}

// ─── AP AGING ─────────────────────────────────────────────────────────────────

export async function computeAPAging() {
  const suppliers = await db.suppliers.filter((s) => (s.balance_owed ?? 0) > 0).toArray()
  if (suppliers.length === 0) return { rows: [], buckets: emptyBuckets(), total: 0 }

  const supplierIds = suppliers.map((s) => s.id)
  const unpaidPurchases = await db.purchases
    .where('supplier_id').anyOf(supplierIds)
    .filter((p) => p.payment_status === 'unpaid')
    .toArray()

  unpaidPurchases.sort((a, b) => a.date.localeCompare(b.date))

  const oldestBySupplier = {}
  for (const p of unpaidPurchases) {
    if (!oldestBySupplier[p.supplier_id]) oldestBySupplier[p.supplier_id] = p.date
  }

  const today = new Date().toISOString().split('T')[0]
  const rows = suppliers
    .map((s) => {
      const oldest = oldestBySupplier[s.id]
      const days = oldest ? daysBetween(oldest, today) : 999
      return {
        ...s,
        oldestPurchaseDate: oldest ?? null,
        daysOutstanding: days,
        bucket: bucket(days),
      }
    })
    .sort((a, b) => b.daysOutstanding - a.daysOutstanding)

  return {
    rows,
    buckets: aggregateBuckets(rows, 'balance_owed'),
    total: suppliers.reduce((s, sup) => s + (sup.balance_owed ?? 0), 0),
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function nDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function daysBetween(from, to) {
  return Math.floor(
    (new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000
  )
}

export function bucket(days) {
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+']

export const BUCKET_COLORS = {
  '0-30': { bg: 'bg-green-100', text: 'text-green-800', bar: '#22c55e' },
  '31-60': { bg: 'bg-yellow-100', text: 'text-yellow-800', bar: '#eab308' },
  '61-90': { bg: 'bg-orange-100', text: 'text-orange-800', bar: '#f97316' },
  '90+': { bg: 'bg-red-100', text: 'text-red-800', bar: '#ef4444' },
}

function emptyBuckets() {
  return { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
}

function aggregateBuckets(rows, amountField) {
  return rows.reduce((acc, r) => {
    acc[r.bucket] = (acc[r.bucket] || 0) + (r[amountField] ?? 0)
    return acc
  }, emptyBuckets())
}

// ─── SALES BY PRODUCT ─────────────────────────────────────────────────────────

export async function computeSalesByProduct({ from, to }) {
  const sales = await db.sales
    .where('date').between(from, to, true, true)
    .filter((s) => !s.voided && s.status !== 'cancelled')
    .toArray()

  if (sales.length === 0) return { rows: [], totalRevenue: 0, totalCogs: 0, totalProfit: 0 }

  const saleIds = sales.map((s) => s.id)
  const items = await db.sale_items.where('sale_id').anyOf(saleIds).toArray()

  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))]
  const products =
    productIds.length > 0
      ? await db.products.where('id').anyOf(productIds).toArray()
      : []
  const pMap = new Map(products.map((p) => [p.id, p]))

  // Aggregate per product
  const productData = {}
  for (const item of items) {
    const pid = item.product_id
    if (!pid) continue
    if (!productData[pid]) {
      productData[pid] = { qty_sold: 0, revenue: 0, cogs: 0 }
    }
    const cost = (item.cost_price && item.cost_price > 0)
      ? item.cost_price
      : (pMap.get(pid)?.cost_price ?? 0)
    productData[pid].qty_sold += item.quantity
    productData[pid].revenue += item.quantity * (item.unit_price ?? 0)
    productData[pid].cogs += item.quantity * cost
  }

  const rows = Object.entries(productData)
    .map(([pid, d]) => {
      const product = pMap.get(pid)
      const gross_profit = d.revenue - d.cogs
      return {
        product_id: pid,
        name: product?.name ?? pid,
        sku: product?.sku ?? null,
        category: product?.category ?? null,
        qty_sold: d.qty_sold,
        revenue: d.revenue,
        cogs: d.cogs,
        gross_profit,
        margin: d.revenue > 0 ? (gross_profit / d.revenue) * 100 : null,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0)
  const totalProfit = totalRevenue - totalCogs

  return { rows, totalRevenue, totalCogs, totalProfit }
}

// ─── SALES BY CATEGORY ────────────────────────────────────────────────────────

export async function computeSalesByCategory({ from, to }) {
  const { rows: productRows, totalRevenue, totalProfit } = await computeSalesByProduct({ from, to })

  // Group product rows into categories
  const categoryData = {}
  for (const row of productRows) {
    const cat = row.category || 'Uncategorised'
    if (!categoryData[cat]) {
      categoryData[cat] = { revenue: 0, cogs: 0, qty_sold: 0, product_count: 0 }
    }
    categoryData[cat].revenue += row.revenue
    categoryData[cat].cogs += row.cogs
    categoryData[cat].qty_sold += row.qty_sold
    categoryData[cat].product_count += 1
  }

  const rows = Object.entries(categoryData)
    .map(([category, d]) => ({
      category,
      revenue: d.revenue,
      cogs: d.cogs,
      gross_profit: d.revenue - d.cogs,
      qty_sold: d.qty_sold,
      product_count: d.product_count,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return { rows, totalRevenue, totalProfit }
}
