-- ── Supplier candidate pool ───────────────────────────────────────────────────
CREATE TABLE supplier_candidates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  supplier_id uuid        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  email       text,
  phone       text,
  headline    text,
  skills      text[]      NOT NULL DEFAULT '{}',
  cv_path     text,
  notes       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_supplier_candidates_updated_at
  BEFORE UPDATE ON supplier_candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE supplier_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_own_candidates"
  ON supplier_candidates FOR ALL
  USING  (EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.profile_id = auth.uid()));

CREATE POLICY "recruiter_admin_view_pool"
  ON supplier_candidates FOR SELECT
  USING (get_my_role() IN ('recruiter', 'admin'));

-- ── Submission status ─────────────────────────────────────────────────────────
CREATE TYPE submission_status AS ENUM (
  'proposed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'
);

-- ── Candidate submissions ─────────────────────────────────────────────────────
CREATE TABLE candidate_submissions (
  id                    uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz       NOT NULL DEFAULT now(),
  demand_id             uuid              NOT NULL REFERENCES demands(id)            ON DELETE CASCADE,
  supplier_id           uuid              NOT NULL REFERENCES suppliers(id)          ON DELETE CASCADE,
  supplier_candidate_id uuid              REFERENCES supplier_candidates(id)        ON DELETE SET NULL,
  candidate_profile_id  uuid              REFERENCES candidate_profiles(id)         ON DELETE SET NULL,
  cv_path               text,
  candidate_name        text              NOT NULL,
  candidate_email       text,
  notes                 text,
  status                submission_status NOT NULL DEFAULT 'proposed',
  submitted_at          timestamptz       NOT NULL DEFAULT now()
);

-- Prevent duplicate submission of the same pool candidate to the same demand
CREATE UNIQUE INDEX candidate_submissions_no_dup
  ON candidate_submissions(demand_id, supplier_id, supplier_candidate_id)
  WHERE supplier_candidate_id IS NOT NULL;

ALTER TABLE candidate_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_own_submissions"
  ON candidate_submissions FOR ALL
  USING  (EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM suppliers s WHERE s.id = supplier_id AND s.profile_id = auth.uid()));

CREATE POLICY "recruiter_admin_submissions"
  ON candidate_submissions FOR ALL
  USING (get_my_role() IN ('recruiter', 'admin'))
  WITH CHECK (get_my_role() IN ('recruiter', 'admin'));

-- ── Storage bucket for supplier CVs ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('supplier-cvs', 'supplier-cvs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "supplier_cv_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-cvs');

CREATE POLICY "supplier_cv_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-cvs');

CREATE POLICY "supplier_cv_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-cvs');
