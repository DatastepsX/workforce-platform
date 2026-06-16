-- Engagements (Beauftragungen)
-- Created when a recruiter/admin commissions a candidate from a demand submission.

CREATE TABLE engagements (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id    UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES candidate_submissions(id) ON DELETE SET NULL,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Denormalized for easy display without joins
  demand_title    TEXT NOT NULL,
  candidate_name  TEXT NOT NULL,
  candidate_email TEXT,
  supplier_name   TEXT,

  start_date DATE,
  end_date   DATE,
  rate       NUMERIC,
  rate_type  TEXT NOT NULL DEFAULT 'daily',
  currency   TEXT NOT NULL DEFAULT 'EUR',

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),

  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;

-- Admins and recruiters: full access
CREATE POLICY "engagements_admin_recruiter"
  ON engagements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'recruiter')
    )
  );

-- Hiring managers: read engagements on demands they created
CREATE POLICY "engagements_hiring_manager_read"
  ON engagements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hiring_manager'
    ) AND
    EXISTS (
      SELECT 1 FROM demands WHERE id = demand_id AND created_by = auth.uid()
    )
  );

-- Suppliers: read engagements for their own candidates
CREATE POLICY "engagements_supplier_read"
  ON engagements FOR SELECT
  USING (
    supplier_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM suppliers WHERE id = supplier_id AND profile_id = auth.uid()
    )
  );
