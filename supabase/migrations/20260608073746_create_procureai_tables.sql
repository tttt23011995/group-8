/*
# ProcureAI — Initial Schema

## Summary
Creates all tables needed for the ProcureAI supply chain & vendor management app,
migrating data that was previously stored in localStorage.

## Tables Created

### vendors
Stores vendor/supplier profiles including contact info, payment terms, lead time, score, and contract dates.

### purchase_orders
Stores purchase orders with status, line items (as JSONB), delivery notes (as JSONB), and delivery performance.

### vendor_ratings
Stores individual vendor quality/delivery/cost/responsiveness ratings.

### delivery_performance
Stores per-PO delivery performance records (on-time flag, days difference).

## Security
- RLS enabled on all tables.
- Single-tenant app (no auth required) — anon + authenticated roles get full CRUD.
  USING (true) is intentional: data is shared/public within this single-tenant deployment.

## Notes
- line_items stored as JSONB array (preserves existing data shape).
- delivery_notes stored as JSONB array (preserves existing data shape).
- No user_id columns: this is a single-tenant procurement tool.
*/

-- ── vendors ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id            text PRIMARY KEY,
  vendor_code   text NOT NULL,
  name          text NOT NULL,
  category      text NOT NULL DEFAULT '',
  contact       text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  lead_time     integer NOT NULL DEFAULT 7,
  payment_terms text NOT NULL DEFAULT 'Net 30',
  score         integer NOT NULL DEFAULT 70,
  status        text NOT NULL DEFAULT 'active',
  location      text NOT NULL DEFAULT '',
  contract_end  text NOT NULL DEFAULT '',
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vendors" ON vendors;
CREATE POLICY "anon_select_vendors" ON vendors FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_vendors" ON vendors;
CREATE POLICY "anon_insert_vendors" ON vendors FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_vendors" ON vendors;
CREATE POLICY "anon_update_vendors" ON vendors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_vendors" ON vendors;
CREATE POLICY "anon_delete_vendors" ON vendors FOR DELETE TO anon, authenticated USING (true);

-- ── purchase_orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                   text PRIMARY KEY,
  po_number            text NOT NULL,
  vendor_id            text NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_name          text NOT NULL,
  date                 text NOT NULL,
  total                numeric NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'ordered',
  items                text NOT NULL DEFAULT '',
  delivery_date        text NOT NULL,
  actual_delivery_date text,
  line_items           jsonb NOT NULL DEFAULT '[]',
  subtotal             numeric,
  tax                  numeric,
  delivery_notes       jsonb NOT NULL DEFAULT '[]',
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pos" ON purchase_orders;
CREATE POLICY "anon_select_pos" ON purchase_orders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pos" ON purchase_orders;
CREATE POLICY "anon_insert_pos" ON purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pos" ON purchase_orders;
CREATE POLICY "anon_update_pos" ON purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pos" ON purchase_orders;
CREATE POLICY "anon_delete_pos" ON purchase_orders FOR DELETE TO anon, authenticated USING (true);

-- ── vendor_ratings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_ratings (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id      text NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  quality        integer NOT NULL DEFAULT 0,
  delivery       integer NOT NULL DEFAULT 0,
  cost           integer NOT NULL DEFAULT 0,
  responsiveness integer NOT NULL DEFAULT 0,
  overall        integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id)
);

ALTER TABLE vendor_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ratings" ON vendor_ratings;
CREATE POLICY "anon_select_ratings" ON vendor_ratings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ratings" ON vendor_ratings;
CREATE POLICY "anon_insert_ratings" ON vendor_ratings FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ratings" ON vendor_ratings;
CREATE POLICY "anon_update_ratings" ON vendor_ratings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ratings" ON vendor_ratings;
CREATE POLICY "anon_delete_ratings" ON vendor_ratings FOR DELETE TO anon, authenticated USING (true);

-- ── delivery_performance ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_performance (
  po_id            text PRIMARY KEY REFERENCES purchase_orders(id) ON DELETE CASCADE,
  on_time          boolean NOT NULL DEFAULT true,
  days_difference  integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_perf" ON delivery_performance;
CREATE POLICY "anon_select_perf" ON delivery_performance FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_perf" ON delivery_performance;
CREATE POLICY "anon_insert_perf" ON delivery_performance FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_perf" ON delivery_performance;
CREATE POLICY "anon_update_perf" ON delivery_performance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_perf" ON delivery_performance;
CREATE POLICY "anon_delete_perf" ON delivery_performance FOR DELETE TO anon, authenticated USING (true);

-- ── indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pos_vendor_id  ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_pos_status     ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_ratings_vendor ON vendor_ratings(vendor_id);
