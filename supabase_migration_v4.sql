-- ─────────────────────────────────────────────────────────────────────────────
-- AutoParts Manager — Migration v4: sales.vat_included
-- Run this in Supabase SQL Editor. Safe to run multiple times.
--
-- The per-sale VAT toggle (NewSale.jsx) writes `vat_included`, but no
-- migration ever added the column. Every sale push was rejected, which also
-- blocked sale_items, stock_movements, expenses and payments from syncing.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sales ADD COLUMN IF NOT EXISTS vat_included BOOLEAN NOT NULL DEFAULT TRUE;

-- Existing sales: VAT was applied exactly when vat_amount > 0
UPDATE sales SET vat_included = (vat_amount > 0) WHERE vat_included <> (vat_amount > 0);
