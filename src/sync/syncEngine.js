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
 *   1. Read the table's pull cursor from localStorage (none on first run).
 *   2. Fetch every row with `updated_at >= cursor` (everything on first run).
 *      `updated_at` is stamped by a server trigger on insert and update, so
 *      it is the server's clock, not the device's.
 *   3. Upsert those rows into the local Dexie tables with `synced = 1`
 *      (they came from the server, so they're already in sync), skipping
 *      rows that were edited locally mid-sync.
 *   4. Advance the cursor to the highest `updated_at` received.
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

// Shown in the UI as "last synced" — not used to decide what to pull.
const LAST_SYNCED_KEY = 'autoparts_lastSyncedAt'

// Per-table pull cursors: the highest server-side `updated_at` seen so far.
// They come from the server's clock (see supabase_migration_v3.sql), never
// the device's, so clock drift or offline edits can't make a device skip rows.
// The key is versioned: bumping it makes every device do one full re-pull,
// which recovers rows the old device-clock cursor silently skipped.
const PULL_CURSORS_KEY = 'autoparts_pullCursors_v2'

function getPullCursors() {
  try {
    return JSON.parse(localStorage.getItem(PULL_CURSORS_KEY)) ?? {}
  } catch {
    return {}
  }
}

function savePullCursors(cursors) {
  localStorage.setItem(PULL_CURSORS_KEY, JSON.stringify(cursors))
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

  await markSynced(tableName, rows)
}

async function pushChildTable(tableName) {
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

const CHILD_TABLES = ['sale_items', 'purchase_items', 'quotation_items', 'return_items']

// Runs every step even if some fail, so one bad table can't block the rest of
// the sync (a failing stock_movements push used to stop sale_items from ever
// uploading and stop the device from ever pulling). Returns the error messages.
async function runEach(steps) {
  const errors = []
  for (const step of steps) {
    try {
      await step()
    } catch (err) {
      errors.push(err.message)
    }
  }
  return errors
}

function pushAll() {
  return runEach([
    ...SYNCED_TABLES.map((t) => () => pushTable(t)),
    // Children after parents so foreign key constraints are satisfied
    ...CHILD_TABLES.map((t) => () => pushChildTable(t)),
  ])
}

// ─── PULL ────────────────────────────────────────────────────────────────────

// PostgREST caps a single response at 1000 rows by default. Page through
// with .range() so a sync never silently drops rows once a table grows past
// that — without this, older/newer rows depending on default ordering would
// simply never reach other devices.
const PAGE_SIZE = 1000

async function pullAllPages(buildQuery) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

// Returns the highest `updated_at` pulled, or `since` if nothing changed.
async function pullTable(tableName, since) {
  const data = await pullAllPages(() => {
    // Stable ordering so .range() pages never skip or repeat rows.
    let query = supabase.from(tableName).select('*').order('updated_at').order('id')
    if (since) {
      // `gte`, not `gt`: several rows can share the cursor's timestamp and a
      // re-fetched row is harmless (bulkPut is idempotent).
      query = query.gte('updated_at', since)
    }
    return query
  }).catch((error) => {
    throw new Error(`Pull failed for ${tableName}: ${error.message}`)
  })

  if (data.length === 0) return since

  // Don't clobber a row edited locally while this sync was running — it is
  // still synced=0 and the next push will send it.
  const pendingIds = new Set((await getUnsynced(tableName)).map((r) => r.id))

  // Store with synced=1 — these came from the server and are up to date.
  const localRows = data
    .filter((r) => !pendingIds.has(r.id))
    .map((r) => ({ ...r, synced: 1 }))
  await upsertLocal(tableName, localRows)

  return data[data.length - 1].updated_at
}

async function pullChildTable(tableName) {
  // Child tables don't have updated_at; pull them all every sync since
  // they tend to be append-only.
  const data = await pullAllPages(() => supabase.from(tableName).select('*')).catch((error) => {
    throw new Error(`Pull failed for ${tableName}: ${error.message}`)
  })
  if (data.length > 0) {
    await upsertLocal(tableName, data)
  }
}

function pullAll() {
  const cursors = getPullCursors()
  return runEach([
    ...SYNCED_TABLES.map((t) => async () => {
      cursors[t] = await pullTable(t, cursors[t] ?? null)
      savePullCursors(cursors)
    }),
    ...CHILD_TABLES.map((t) => () => pullChildTable(t)),
  ])
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

  const errors = [...(await pushAll()), ...(await pullAll())]
  if (errors.length > 0) throw new Error(errors.join(' | '))

  const syncedAt = new Date().toISOString()
  localStorage.setItem(LAST_SYNCED_KEY, syncedAt)
  return syncedAt
}
