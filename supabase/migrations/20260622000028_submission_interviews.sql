-- WFX-028: Interview data capture per submission

CREATE TABLE IF NOT EXISTS submission_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES candidate_submissions(id) ON DELETE CASCADE,
  demand_id UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  interviewer_name TEXT,
  interview_date DATE,
  interview_type TEXT NOT NULL DEFAULT 'video'
    CHECK (interview_type IN ('video', 'onsite', 'phone', 'technical', 'hr')),
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE submission_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interviews_admin_recruiter_all" ON submission_interviews
  FOR ALL
  USING (get_my_role() IN ('recruiter', 'admin'))
  WITH CHECK (get_my_role() IN ('recruiter', 'admin'));

CREATE POLICY "interviews_hm_select" ON submission_interviews
  FOR SELECT
  USING (
    get_my_role() = 'hiring_manager'
    AND demand_id IN (
      SELECT id FROM demands
      WHERE created_by = auth.uid()
         OR (get_my_tenant_id() IS NOT NULL AND tenant_id = get_my_tenant_id())
    )
  );
