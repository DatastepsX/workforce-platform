-- Add total_amount (final agreed price) and price_locked (manually set) to engagements
ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS price_locked BOOLEAN NOT NULL DEFAULT FALSE;
