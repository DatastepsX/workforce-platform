-- Add rate and location fields to supplier_candidates for better matching
ALTER TABLE supplier_candidates
  ADD COLUMN IF NOT EXISTS hourly_rate_min numeric,
  ADD COLUMN IF NOT EXISTS hourly_rate_max numeric,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS availability text,
  ADD COLUMN IF NOT EXISTS location text;
