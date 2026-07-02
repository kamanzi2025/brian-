-- ─────────────────────────────────────────────────────────────────────────────
-- AutoParts Manager — Migration v2
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → paste → Run)
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS guards)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add new columns to payments ───────────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS supplier_id    UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS proof_image    TEXT,        -- base64 data URL
  ADD COLUMN IF NOT EXISTS rmb_amount     NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS exchange_rate  NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS note           TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments (supplier_id);

-- ── 2. Add new columns to purchases ──────────────────────────────────────────
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS rmb_total     NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS deposit_paid  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_cost  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tab_id        UUID;

-- ── 3. Add new columns to purchase_items ─────────────────────────────────────
ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS rmb_unit_cost NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS freight_cost  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_per_item  NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ── 4. Add new columns to sales ──────────────────────────────────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS salesman_name    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- ── 5. Create supplier_tabs table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_tabs (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      UUID          NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status           TEXT          NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  opened_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
  closed_date      DATE,
  total_purchases  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_paid       NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  synced           BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE TRIGGER supplier_tabs_updated_at
  BEFORE UPDATE ON supplier_tabs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE supplier_tabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON supplier_tabs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_supplier_tabs_supplier ON supplier_tabs (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_tabs_status   ON supplier_tabs (status);
CREATE INDEX IF NOT EXISTS idx_supplier_tabs_updated  ON supplier_tabs (updated_at);

-- ── 6. Create fixed_expense_config table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_expense_config (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  rent         NUMERIC(12,2) NOT NULL DEFAULT 0,
  salaries     NUMERIC(12,2) NOT NULL DEFAULT 0,
  electricity  NUMERIC(12,2) NOT NULL DEFAULT 0,
  water        NUMERIC(12,2) NOT NULL DEFAULT 0,
  fuel         NUMERIC(12,2) NOT NULL DEFAULT 0,
  bank_loan    NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_fixed  NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  synced       BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE TRIGGER fixed_expense_config_updated_at
  BEFORE UPDATE ON fixed_expense_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE fixed_expense_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner full access" ON fixed_expense_config
  FOR ALL USING (auth.role() = 'authenticated');

