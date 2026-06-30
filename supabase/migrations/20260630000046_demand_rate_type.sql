-- Add rate_type to demands table (was referenced in code but never migrated)
ALTER TABLE demands ADD COLUMN IF NOT EXISTS rate_type TEXT DEFAULT 'daily';
