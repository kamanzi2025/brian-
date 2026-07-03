/**
 * SYNC ENGINE — How it works
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PUSH (local → Supabase):
 *   1. Query every table for rows where `synced = 0` (falsy in Dexie).
 *   2. Upsert them into Supabase using `upsert({ onConflict: 'id' })`.
 *      Because there's only one user, this is safe — a newer device write
 *      simply overwrites an older one.
 *   3. On success, flip `synced = 1` in IndexedDB for those rows.
 *
 * PULL (Supabase → local):
 *   1. Read `lastSyncedAt` from localStorage (null on first run).
 *   2. Fetch from each Supabase table all rows where `updated_at > lastSyncedAt`.
 *      On first run, fetch everything.
 *   3. Upsert those rows into the local Dexie tables with `synced = 1`
 *      (they came from the server, so they're already in sync).
 *   4. Save the current timestamp to `lastSyncedAt` in localStorage.
 *
 * CONFLICT RESOLUTION:
 *   Most-recent-write wins. Both sides store `updated_at`. During pull,
 *   if a remote row has a newer `updated_at` than the local copy, the
 *   `bulkPut` overwrites it. Since there's only one user across devices,
 *   the chance of a true conflict (editing the same record on two offline
 *   devices simultaneously) is extremely rare, and the "last write wins"
 *   strategy is the simplest correct approach for this use case.
 *
 * TABLES WITH NO `synced` FIELD (sale_items, purchase_items):
 *   These are child rows — they're synced by walking the parent relationship.
 *   When a sale is synced, its items are synced at the same time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db, getUnsynced, markSynced, upsertLocal } from '../db/db'
import { supabase, SUPABASE_CONFIGURED } from '../db/supabase'

// Tables that have their own `synced` flag and are synced independently
const SYNCED_TABLES = [
  'products',
  'customers',
  'suppliers',
  'sales',
  'purchases',
  'expenses',
  'payments',
  'quotations',
  'returns',
  'stock_movements',
  'supplier_tabs',
]

// Child tables that need to be pushed alongside their parent
const CHILD_TABLES = ['sale_items', 'purchase_items', 'quotation_items', 'return_items']

const LAST_SYNCED_KEY = 'autoparts_lastSyncedAt'

function getLastSyncedAt() {
  return localStorage.getItem(LAST_SYNCED_KEY) // ISO string or null
}

function saveLastSyncedAt(isoString) {
  localStorage.setItem(LAST_SYNCED_KEY, isoString)
}

// ─── PUSH ────────────────────────────────────────────────────────────────────

async function pushTable(tableName) {
  const rows = await getUnsynced(tableName)
  if (rows.length === 0) return

  // Dexie stores `synced` as 0/1 integers; strip it before sending to Postgres
  // (Postgres has a boolean column — Supabase JS client handles the cast, but
  // we set it to true explicitly here so the server row is clean)
  const payload = rows.map((r) => ({ ...r, synced: true }))

  const { error } = await supabase.from(tableName).upsert(payload, {
    onConflict: 'id',
  })

  if (error) throw new Error(`Push failed for ${tableName}: ${error.message}`)

  await markSynced(tableName, rows.map((r) => r.id))
}

async function pushChildTable(tableName, parentIdField) {
  // For child tables we push all rows because they have no `synced` flag.
  // In practice, parent rows are pushed first; by the time a parent is synced
  // the children should be consistent. A simple "push everything" approach
  // is safe here because Supabase upsert is idempotent.
  const rows = await db[tableName].toArray()
  if (rows.length === 0) return

  const { error } = await supabase.from(tableName).upsert(rows, {
    onConflict: 'id',
  })

  if (error)
    throw new Error(`Push failed for ${tableName}: ${error.message}`)
}

async function pushAll() {
  for (const table of SYNCED_TABLES) {
    await pushTable(table)
  }
  // Push children after parents so foreign key constraints are satisfied
  await pushChildTable('sale_items', 'sale_id')
  await pushChildTable('purchase_items', 'purchase_id')
  await pushChildTable('quotation_items', 'quotation_id')
  await pushChildTable('return_items', 'return_id')
}

// ─── PULL ────────────────────────────────────────────────────────────────────

async function pullTable(tableName, since) {
  let query = supabase.from(tableName).select('*')

  if (since) {
    // Only fetch rows that changed after our last sync.
    // `gt` = strictly greater than, so we don't re-fetch the row that set
    // the lastSyncedAt timestamp.
    query = query.gt('updated_at', since)
  }

  const { data, error } = await query

  if (error) throw new Error(`Pull failed for ${tableName}: ${error.message}`)
  if (!data || data.length === 0) return

  // Store with synced=1 — these came from the server and are up to date.
  // Dexie's bulkPut overwrites existing rows with the same primary key,
  // so this acts as "last write wins" for the local copy.
  const localRows = data.map((r) => ({ ...r, synced: 1 }))
  await upsertLocal(tableName, localRows)
}

async function pullChildTable(tableName, since) {
  // Child tables don't have updated_at; pull them all on first sync,
  // or pull by parent id delta on subsequent syncs (simple: just pull all
  // that are newer than any recently synced parent — here we keep it simple
  // and pull everything, since these tables tend to be append-only)
  const { data, error } = await supabase.from(tableName).select('*')
  if (error)
    throw new Error(`Pull failed for ${tableName}: ${error.message}`)
  if (data && data.length > 0) {
    await upsertLocal(tableName, data)
  }
}

async function pullAll(since) {
  for (const table of SYNCED_TABLES) {
    await pullTable(table, since)
  }
  await pullChildTable('sale_items', since)
  await pullChildTable('purchase_items', since)
  await pullChildTable('quotation_items', since)
  await pullChildTable('return_items', since)
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Run a full sync cycle: push unsynced local changes, then pull remote changes.
 * Returns the new lastSyncedAt ISO timestamp on success.
 * Throws on any error (caller should catch and set status to 'error').
 */
export async function runSync() {
  // No credentials — running in local-only mode, nothing to sync
  if (!SUPABASE_CONFIGURED) return new Date().toISOString()

  // Verify we have an active session before attempting network calls
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const since = getLastSyncedAt()

  await pushAll()

  // Capture "now" before pulling so we don't miss records written between
  // the start of this push and the end of the pull
  const syncedAt = new Date().toISOString()

  await pullAll(since)

  saveLastSyncedAt(syncedAt)
  return syncedAt
}
