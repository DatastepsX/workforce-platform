-- Per-tenant compliance rule overrides
-- NULL in any override column means "inherit from platform default"
CREATE TABLE tenant_compliance_rule_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id           UUID NOT NULL REFERENCES compliance_rules(id) ON DELETE CASCADE,
  active_override   BOOLEAN,      -- NULL = inherit; true/false = override
  threshold_override NUMERIC,     -- NULL = inherit; value = override threshold
  severity_override TEXT CHECK (severity_override IN ('info','warning','error')), -- NULL = inherit
  override_allowed_override BOOLEAN, -- NULL = inherit
  notes             TEXT,
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, rule_id)
);

CREATE OR REPLACE FUNCTION update_tenant_rule_overrides_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_tenant_rule_overrides_updated_at
  BEFORE UPDATE ON tenant_compliance_rule_overrides
  FOR EACH ROW EXECUTE FUNCTION update_tenant_rule_overrides_updated_at();

ALTER TABLE tenant_compliance_rule_overrides ENABLE ROW LEVEL SECURITY;

-- Read: admin sees own tenant; super_admin sees all
CREATE POLICY "tcro_read" ON tenant_compliance_rule_overrides FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin' OR
    (get_is_admin() AND tenant_id = get_my_tenant_id())
  );

-- Write: super_admin can override for any tenant; admin for their own
CREATE POLICY "tcro_write" ON tenant_compliance_rule_overrides FOR ALL TO authenticated
  USING (
    get_my_role() = 'super_admin' OR
    (get_is_admin() AND tenant_id = get_my_tenant_id())
  )
  WITH CHECK (
    get_my_role() = 'super_admin' OR
    (get_is_admin() AND tenant_id = get_my_tenant_id())
  );
