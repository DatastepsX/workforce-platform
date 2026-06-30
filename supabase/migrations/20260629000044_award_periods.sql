-- Add billing_period_type to demands and awards
ALTER TABLE demands ADD COLUMN IF NOT EXISTS billing_period_type TEXT
  CHECK (billing_period_type IN ('weekly','bi_weekly','monthly','milestone','fixed'));

ALTER TABLE awards ADD COLUMN IF NOT EXISTS billing_period_type TEXT
  CHECK (billing_period_type IN ('weekly','bi_weekly','monthly','milestone','fixed'));

-- Award Billing Periods (auto-generated from award dates + period type)
CREATE TABLE award_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id      UUID NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  period_number INT  NOT NULL,
  period_type   TEXT NOT NULL CHECK (period_type IN ('weekly','bi_weekly','monthly','milestone','fixed')),
  label         TEXT NOT NULL,         -- e.g. "Week 1", "July 2026", "Milestone 3"
  start_date    DATE,
  end_date      DATE,
  status        TEXT NOT NULL CHECK (status IN ('open','submitted','approved','invoiced')) DEFAULT 'open',
  total_amount  NUMERIC,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (award_id, period_number)
);

-- Cost Entries per Period (timesheets, expenses, milestones)
CREATE TABLE period_cost_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     UUID NOT NULL REFERENCES award_periods(id) ON DELETE CASCADE,
  award_id      UUID NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  cost_item_id  UUID REFERENCES cost_items(id) ON DELETE SET NULL,
  submitted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entry_type    TEXT NOT NULL CHECK (entry_type IN ('timesheet','expense','milestone','fee')),
  quantity      NUMERIC NOT NULL DEFAULT 0,      -- hours, days, km, units
  unit_price    NUMERIC NOT NULL DEFAULT 0,      -- rate per unit
  amount        NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  description   TEXT,
  notes         TEXT,
  attachment_path TEXT,                           -- receipt / timesheet doc path
  status        TEXT NOT NULL CHECK (status IN ('draft','submitted','approved','rejected')) DEFAULT 'draft',
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers
CREATE OR REPLACE FUNCTION update_award_periods_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_award_periods_updated_at
  BEFORE UPDATE ON award_periods
  FOR EACH ROW EXECUTE FUNCTION update_award_periods_updated_at();

CREATE OR REPLACE FUNCTION update_period_cost_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_period_cost_entries_updated_at
  BEFORE UPDATE ON period_cost_entries
  FOR EACH ROW EXECUTE FUNCTION update_period_cost_entries_updated_at();

-- RLS
ALTER TABLE award_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_cost_entries ENABLE ROW LEVEL SECURITY;

-- award_periods: admin/recruiter/procurement/finance see all for their tenant; supplier/candidate see their own award periods
CREATE POLICY "ap_read_staff"  ON award_periods FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','super_admin','recruiter','hiring_manager','procurement','finance'));

CREATE POLICY "ap_read_supplier" ON award_periods FOR SELECT TO authenticated
  USING (
    get_my_role() = 'supplier' AND
    EXISTS (
      SELECT 1 FROM awards a WHERE a.id = award_id AND a.supplier_id IN (
        SELECT id FROM suppliers WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "ap_read_candidate" ON award_periods FOR SELECT TO authenticated
  USING (
    get_my_role() = 'candidate' AND
    EXISTS (
      SELECT 1 FROM awards a
      JOIN candidate_submissions cs ON cs.id = a.submission_id
      WHERE a.id = award_id AND cs.candidate_profile_id = auth.uid()
    )
  );

CREATE POLICY "ap_write_admin" ON award_periods FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','super_admin','recruiter'))
  WITH CHECK (get_my_role() IN ('admin','super_admin','recruiter'));

-- period_cost_entries: same staff visibility; supplier/candidate can create/edit their own draft entries
CREATE POLICY "pce_read_staff" ON period_cost_entries FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','super_admin','recruiter','hiring_manager','procurement','finance'));

CREATE POLICY "pce_read_supplier" ON period_cost_entries FOR SELECT TO authenticated
  USING (get_my_role() = 'supplier' AND submitted_by = auth.uid());

CREATE POLICY "pce_read_candidate" ON period_cost_entries FOR SELECT TO authenticated
  USING (get_my_role() = 'candidate' AND submitted_by = auth.uid());

CREATE POLICY "pce_insert_submitter" ON period_cost_entries FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'draft');

CREATE POLICY "pce_update_own_draft" ON period_cost_entries FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND status = 'draft')
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "pce_admin_all" ON period_cost_entries FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','super_admin','recruiter','procurement','finance'));
