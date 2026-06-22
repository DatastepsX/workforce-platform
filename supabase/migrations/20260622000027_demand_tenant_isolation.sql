-- WFX-024: Multi-tenant data isolation for demands

ALTER TABLE demands ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

UPDATE demands d
SET tenant_id = p.tenant_id
FROM profiles p
WHERE d.created_by = p.id AND d.tenant_id IS NULL AND p.tenant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_tenant_id() TO authenticated;

DROP POLICY IF EXISTS "demands_select" ON demands;
CREATE POLICY "demands_select" ON demands
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR get_my_role() = 'admin'
    OR (
      get_my_role() = 'recruiter'
      AND (
        get_my_tenant_id() IS NULL
        OR tenant_id IS NULL
        OR tenant_id = get_my_tenant_id()
      )
    )
    OR (
      get_my_role() = 'hiring_manager'
      AND get_my_tenant_id() IS NOT NULL
      AND tenant_id = get_my_tenant_id()
    )
  );
