-- ── Career portal: direct applications ───────────────────────────────────────

-- supplier_id nullable → direct applications have no supplier
ALTER TABLE public.candidate_submissions
  ALTER COLUMN supplier_id DROP NOT NULL;

-- Source tracking: where did the application come from?
ALTER TABLE public.candidate_submissions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'supplier'
  CHECK (source IN ('supplier', 'direct'));

-- Anon users can read open demands (career portal)
CREATE POLICY "demands_public_read"
  ON public.demands FOR SELECT
  TO anon
  USING (status = 'open');

-- Candidates can read their own direct submissions
CREATE POLICY "candidate_own_submissions_select"
  ON public.candidate_submissions FOR SELECT
  USING (candidate_profile_id = auth.uid());
