-- Add updated_at to engagements with auto-update trigger
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE engagements SET updated_at = created_at;
ALTER TABLE engagements ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE engagements ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE OR REPLACE FUNCTION update_engagements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS engagements_updated_at ON engagements;
CREATE TRIGGER engagements_updated_at
  BEFORE UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION update_engagements_updated_at();
