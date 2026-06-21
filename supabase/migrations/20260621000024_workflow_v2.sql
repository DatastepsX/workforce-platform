-- Workflow v2: clean 10-status model + tenants + tenant_configs + process_history
-- Replaces the over-engineered Phase 1 model (migration 23)

-- ── Clean up migration 23 artifacts (apply-safe: IF EXISTS) ──────────────────
ALTER TABLE demands DROP COLUMN IF EXISTS process_stage;
ALTER TABLE demands DROP COLUMN IF EXISTS process_status;
ALTER TABLE demands DROP COLUMN IF EXISTS current_owner_role;
DROP TYPE IF EXISTS process_stage CASCADE;
DROP TYPE IF EXISTS demand_process_status CASCADE;
DROP TABLE IF EXISTS process_history;

-- ── Rebuild demand_status enum ────────────────────────────────────────────────
-- Drop policies that reference the status column (required before ALTER COLUMN TYPE)
DROP POLICY IF EXISTS "demands_public_read" ON public.demands;

-- Convert to text first so we can safely swap the enum type
ALTER TABLE demands ALTER COLUMN status TYPE text USING status::text;

-- Map old values → new values
UPDATE demands SET status = CASE status
  WHEN 'open'        THEN 'sourcing'
  WHEN 'in_progress' THEN 'screening'
  WHEN 'closed'      THEN 'filled'
  ELSE status   -- draft, on_hold, cancelled unchanged
END;

DROP TYPE IF EXISTS demand_status CASCADE;

CREATE TYPE demand_status AS ENUM (
  'draft',
  'pending_review',
  'pending_approval',
  'sourcing',
  'screening',
  'interview',
  'award',
  'contracting',
  'filled',
  'on_hold',
  'cancelled',
  'rejected'
);

ALTER TABLE demands
  ALTER COLUMN status TYPE demand_status USING status::demand_status,
  ALTER COLUMN status SET DEFAULT 'draft';

-- Tracks which approval level is active (1-3) during pending_approval / award
ALTER TABLE demands ADD COLUMN IF NOT EXISTS approval_level integer DEFAULT NULL;

-- Recreate the public read policy with new status values
DROP POLICY IF EXISTS "demands_public_read" ON public.demands;
CREATE POLICY "demands_public_read"
  ON public.demands FOR SELECT
  TO anon
  USING (status IN ('sourcing', 'screening', 'interview') AND 'career_portal' = ANY(channels));

-- ── Tenants ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Insert a default tenant so the app works out of the box
INSERT INTO tenants (name, slug) VALUES ('Default', 'default')
  ON CONFLICT (slug) DO NOTHING;

-- ── Tenant configuration ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_configs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  -- Demand intake workflow
  demand_msp_review        boolean NOT NULL DEFAULT true,
  demand_approval_levels   integer NOT NULL DEFAULT 1 CHECK (demand_approval_levels BETWEEN 0 AND 3),
  demand_approval_role_l1  text    DEFAULT 'hiring_manager',
  demand_approval_role_l2  text    DEFAULT NULL,
  demand_approval_role_l3  text    DEFAULT NULL,
  demand_msp_screening     boolean NOT NULL DEFAULT true,
  -- Award workflow (mirrors demand)
  award_msp_offer          boolean NOT NULL DEFAULT true,
  award_approval_levels    integer NOT NULL DEFAULT 1 CHECK (award_approval_levels BETWEEN 0 AND 3),
  award_approval_role_l1   text    DEFAULT 'procurement',
  award_approval_role_l2   text    DEFAULT NULL,
  award_approval_role_l3   text    DEFAULT NULL,
  award_po_step            boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Insert default config for the default tenant
INSERT INTO tenant_configs (tenant_id, demand_msp_review, demand_approval_levels, demand_msp_screening)
  SELECT id, true, 1, true FROM tenants WHERE slug = 'default'
  ON CONFLICT DO NOTHING;

-- ── Process history ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id   uuid NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  action      text NOT NULL,
  actor_id    uuid REFERENCES auth.users(id),
  actor_role  text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS process_history_demand_idx
  ON process_history (demand_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_history ENABLE ROW LEVEL SECURITY;

-- Tenants: admin full access; all authenticated can read
CREATE POLICY "admin_manage_tenants" ON tenants FOR ALL
  USING (get_my_role() = 'admin');
CREATE POLICY "auth_read_tenants" ON tenants FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Tenant configs: admin full access; all authenticated can read
CREATE POLICY "admin_manage_tenant_configs" ON tenant_configs FOR ALL
  USING (get_my_role() = 'admin');
CREATE POLICY "auth_read_tenant_configs" ON tenant_configs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Process history
CREATE POLICY "admin_recruiter_all_history" ON process_history FOR ALL
  USING (get_my_role() IN ('admin', 'recruiter'));

CREATE POLICY "hiring_manager_read_history" ON process_history FOR SELECT
  USING (
    get_my_role() = 'hiring_manager'
    AND demand_id = ANY(ARRAY(SELECT get_my_demand_ids()))
  );

CREATE POLICY "hiring_manager_insert_history" ON process_history FOR INSERT
  WITH CHECK (get_my_role() IN ('hiring_manager', 'recruiter', 'admin'));
