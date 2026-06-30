-- WFX-034: Career ladders per tenant
-- Add tenant_id to career_ladders so each client owns their own ladders.
-- Delete generic global seeded ladders (cascade to steps).
-- Update RLS: admin/recruiter see their tenant's ladders; super_admin sees all.

BEGIN;

-- Add tenant_id column
ALTER TABLE career_ladders
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Clean up the generic global seeded ladders (no tenant_id = global)
-- Steps are deleted via CASCADE
DELETE FROM career_ladders WHERE tenant_id IS NULL;

-- Drop old policies
DROP POLICY IF EXISTS "cl_read_all_auth"  ON career_ladders;
DROP POLICY IF EXISTS "cl_write_admin_rec" ON career_ladders;

-- New scoped policies
CREATE POLICY "cl_select" ON career_ladders
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'recruiter', 'hiring_manager', 'procurement', 'finance')
      AND tenant_id = get_my_tenant_id()
    )
    -- candidates see their tenant's ladders (for career navigator)
    OR (
      get_my_role() = 'candidate'
      AND (get_my_tenant_id() IS NULL OR tenant_id = get_my_tenant_id())
    )
  );

CREATE POLICY "cl_insert" ON career_ladders
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'recruiter')
      AND tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "cl_update" ON career_ladders
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'recruiter')
      AND tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "cl_delete" ON career_ladders
  FOR DELETE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'recruiter')
      AND tenant_id = get_my_tenant_id()
    )
  );

COMMIT;
