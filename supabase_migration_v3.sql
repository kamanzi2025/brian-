-- ─────────────────────────────────────────────────────────────────────────────
-- AutoParts Manager — Migration v3: server-side updated_at on INSERT too
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → paste → Run)
-- Safe to run multiple times.
--
-- Why: the existing triggers only fire BEFORE UPDATE, so a newly inserted row
-- kept the updated_at written by the device's own clock. A sale recorded
-- offline on one device (or on a device with a wrong clock) got an updated_at
-- older than the other device's last-sync cursor and was never pulled there —
-- which is how the phone and the laptop ended up with different stock.
-- Stamping every insert and update with the server clock makes updated_at a
-- reliable "changed on the server at" cursor for incremental pulls.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'customers', 'suppliers', 'sales', 'purchases', 'expenses',
    'payments', 'quotations', 'returns', 'stock_movements', 'supplier_tabs'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_updated_at', t
    );
  END LOOP;
END $$;
