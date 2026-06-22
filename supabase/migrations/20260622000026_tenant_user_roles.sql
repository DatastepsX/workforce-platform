-- Sprint 3: tenant_id on profiles + tenant_roles table + demo seed data

-- 1. Add tenant_id to profiles (nullable — platform-level admin has no tenant)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- 2. tenant_roles: per-tenant role config (label override + active toggle)
CREATE TABLE IF NOT EXISTS tenant_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_key    TEXT NOT NULL,   -- matches profiles.role enum values
  label       TEXT NOT NULL,   -- display name for this tenant context
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, role_key)
);

ALTER TABLE tenant_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_tenant_roles"
  ON tenant_roles FOR ALL
  USING (get_my_role() = 'admin');

CREATE POLICY "auth_read_tenant_roles"
  ON tenant_roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Allow admin to update profiles.tenant_id (existing admin policy covers ALL)

-- 4. Seed demo tenants + configs + roles + user assignments (WFX-027)
DO $$
DECLARE
  siemens_id UUID;
  allianz_id UUID;
  hm_id      UUID;
BEGIN
  -- ── Siemens AG — full MSP workflow ──────────────────────────────────────
  INSERT INTO tenants (name, slug, active)
  VALUES ('Siemens AG', 'siemens-ag', true)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO siemens_id;

  INSERT INTO tenant_configs (
    tenant_id,
    demand_msp_review, demand_approval_levels, demand_approval_role_l1, demand_approval_role_l2,
    demand_msp_screening,
    award_msp_offer, award_approval_levels, award_approval_role_l1, award_po_step
  ) VALUES (
    siemens_id,
    true, 2, 'hiring_manager', 'admin',
    true,
    true, 1, 'hiring_manager', false
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    demand_msp_review      = EXCLUDED.demand_msp_review,
    demand_approval_levels = EXCLUDED.demand_approval_levels,
    demand_approval_role_l1 = EXCLUDED.demand_approval_role_l1,
    demand_approval_role_l2 = EXCLUDED.demand_approval_role_l2,
    demand_msp_screening   = EXCLUDED.demand_msp_screening,
    award_msp_offer        = EXCLUDED.award_msp_offer,
    award_approval_levels  = EXCLUDED.award_approval_levels,
    award_approval_role_l1 = EXCLUDED.award_approval_role_l1,
    award_po_step          = EXCLUDED.award_po_step;

  INSERT INTO tenant_roles (tenant_id, role_key, label, active) VALUES
    (siemens_id, 'admin',           'MSP Admin',   true),
    (siemens_id, 'recruiter',       'MSP Service', true),
    (siemens_id, 'hiring_manager',  'Client HM',   true),
    (siemens_id, 'supplier',        'Supplier',    true),
    (siemens_id, 'candidate',       'Candidate',   true)
  ON CONFLICT (tenant_id, role_key) DO NOTHING;

  -- Assign existing hiring_manager test user to Siemens AG
  UPDATE profiles SET tenant_id = siemens_id WHERE role = 'hiring_manager';

  -- ── Allianz SE — self-service (no MSP steps) ────────────────────────────
  INSERT INTO tenants (name, slug, active)
  VALUES ('Allianz SE', 'allianz-se', true)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO allianz_id;

  INSERT INTO tenant_configs (
    tenant_id,
    demand_msp_review, demand_approval_levels, demand_approval_role_l1,
    demand_msp_screening,
    award_msp_offer, award_approval_levels, award_approval_role_l1, award_po_step
  ) VALUES (
    allianz_id,
    false, 1, 'hiring_manager',
    false,
    false, 0, null, false
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    demand_msp_review      = EXCLUDED.demand_msp_review,
    demand_approval_levels = EXCLUDED.demand_approval_levels,
    demand_approval_role_l1 = EXCLUDED.demand_approval_role_l1,
    demand_msp_screening   = EXCLUDED.demand_msp_screening,
    award_msp_offer        = EXCLUDED.award_msp_offer,
    award_approval_levels  = EXCLUDED.award_approval_levels,
    award_approval_role_l1 = EXCLUDED.award_approval_role_l1,
    award_po_step          = EXCLUDED.award_po_step;

  INSERT INTO tenant_roles (tenant_id, role_key, label, active) VALUES
    (allianz_id, 'hiring_manager', 'Hiring Manager', true),
    (allianz_id, 'supplier',       'Vendor',         true),
    (allianz_id, 'candidate',      'Applicant',      true)
  ON CONFLICT (tenant_id, role_key) DO NOTHING;

END $$;
