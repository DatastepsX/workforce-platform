ALTER TABLE public.candidate_submissions
  ADD COLUMN IF NOT EXISTS proposed_rate  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rate_type      TEXT DEFAULT 'daily';   -- daily | hourly | monthly | fixed
