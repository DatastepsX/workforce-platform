-- Award module: separate entity with its own status workflow, independent from demands.
-- Future: change orders, multiple awards per demand (multi-resource), PO tracking.

CREATE TABLE awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid REFERENCES demands(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES candidate_submissions(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  -- Denormalized for display (source records may change or be deleted)
  candidate_name text NOT NULL,
  candidate_email text,
  supplier_name text,
  demand_title text NOT NULL,
  -- Financial terms
  rate numeric,
  rate_type text,
  currency text NOT NULL DEFAULT 'EUR',
  total_amount numeric,
  price_locked boolean NOT NULL DEFAULT false,
  -- Contract period
  start_date date,
  end_date date,
  -- Status: pending_approval → approved → active → completed | cancelled
  status text NOT NULL DEFAULT 'pending_approval',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_awards_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS awards_updated_at ON awards;
CREATE TRIGGER awards_updated_at
  BEFORE UPDATE ON awards
  FOR EACH ROW EXECUTE FUNCTION update_awards_updated_at();

ALTER TABLE awards ENABLE ROW LEVEL SECURITY;

-- SELECT: all internal roles, scoped to their tenant
CREATE POLICY "awards_select" ON awards FOR SELECT USING (
  get_my_role() IN ('super_admin', 'admin', 'recruiter', 'hiring_manager', 'procurement', 'finance')
  AND (
    get_my_role() = 'super_admin'
    OR get_my_tenant_id() IS NULL
    OR tenant_id IS NULL
    OR tenant_id = get_my_tenant_id()
  )
);

-- INSERT: award creators
CREATE POLICY "awards_insert" ON awards FOR INSERT WITH CHECK (
  get_my_role() IN ('super_admin', 'admin', 'recruiter', 'hiring_manager')
);

-- UPDATE: MSP roles can approve / transition status
CREATE POLICY "awards_update" ON awards FOR UPDATE USING (
  get_my_role() IN ('super_admin', 'admin', 'recruiter')
) WITH CHECK (
  get_my_role() IN ('super_admin', 'admin', 'recruiter')
);

-- DELETE: admin / super_admin only
CREATE POLICY "awards_delete" ON awards FOR DELETE USING (
  get_my_role() IN ('super_admin', 'admin')
);
