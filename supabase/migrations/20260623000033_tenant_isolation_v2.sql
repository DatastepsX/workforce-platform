-- WFX-033: Tenant isolation v2
-- Fix demands_select so that admin WITH a tenant_id only sees their tenant's demands.
-- Add procurement + finance to demands_select (scoped to their tenant).
-- super_admin always sees everything.

BEGIN;

-- ── demands ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "demands_select" ON demands;
CREATE POLICY "demands_select" ON demands
  FOR SELECT
  USING (
    created_by = auth.uid()
    -- super_admin sees all
    OR get_my_role() = 'super_admin'
    -- admin/recruiter: see own tenant's demands (or all if no tenant assigned)
    OR (
      get_my_role() IN ('admin', 'recruiter')
      AND (
        get_my_tenant_id() IS NULL
        OR tenant_id IS NULL
        OR tenant_id = get_my_tenant_id()
      )
    )
    -- hiring_manager: own tenant only
    OR (
      get_my_role() = 'hiring_manager'
      AND get_my_tenant_id() IS NOT NULL
      AND tenant_id = get_my_tenant_id()
    )
    -- procurement / finance: own tenant only (read-only oversight)
    OR (
      get_my_role() IN ('procurement', 'finance')
      AND get_my_tenant_id() IS NOT NULL
      AND tenant_id = get_my_tenant_id()
    )
  );

-- ── candidate_submissions ──────────────────────────────────────────────────────
-- Add procurement/finance read access (they need to see submissions for their demands)

DROP POLICY IF EXISTS "cs_select_admin_recruiter" ON candidate_submissions;
DROP POLICY IF EXISTS "cs_select" ON candidate_submissions;

CREATE POLICY "cs_select" ON candidate_submissions
  FOR SELECT
  USING (
    -- Own submission as candidate
    candidate_profile_id = auth.uid()
    -- super_admin sees all
    OR get_my_role() = 'super_admin'
    -- admin/recruiter: submissions for their tenant's demands
    OR (
      get_my_role() IN ('admin', 'recruiter')
      AND (
        get_my_tenant_id() IS NULL
        OR demand_id IN (
          SELECT id FROM demands
          WHERE tenant_id IS NULL OR tenant_id = get_my_tenant_id()
        )
      )
    )
    -- hiring_manager: submissions for their own demands
    OR demand_id IN (SELECT get_my_demand_ids())
    -- procurement/finance: submissions for their tenant's demands (read)
    OR (
      get_my_role() IN ('procurement', 'finance')
      AND get_my_tenant_id() IS NOT NULL
      AND demand_id IN (
        SELECT id FROM demands WHERE tenant_id = get_my_tenant_id()
      )
    )
    -- supplier: their own submissions
    OR supplier_id IN (SELECT get_my_supplier_ids())
  );

-- ── engagements ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "eng_select" ON engagements;
DROP POLICY IF EXISTS "eng_select_all_admin" ON engagements;

CREATE POLICY "eng_select" ON engagements
  FOR SELECT
  USING (
    supplier_id IN (SELECT get_my_supplier_ids())
    OR get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'recruiter')
      AND (
        get_my_tenant_id() IS NULL
        OR demand_id IN (
          SELECT id FROM demands
          WHERE tenant_id IS NULL OR tenant_id = get_my_tenant_id()
        )
      )
    )
    OR (
      get_my_role() = 'hiring_manager'
      AND demand_id IN (SELECT get_my_demand_ids())
    )
    OR (
      get_my_role() IN ('procurement', 'finance')
      AND get_my_tenant_id() IS NOT NULL
      AND demand_id IN (
        SELECT id FROM demands WHERE tenant_id = get_my_tenant_id()
      )
    )
  );

COMMIT;
