-- Add cost item workflow config flags to tenant_configs
ALTER TABLE tenant_configs
  ADD COLUMN IF NOT EXISTS cost_msp_review  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cost_hm_approval BOOLEAN NOT NULL DEFAULT TRUE;
