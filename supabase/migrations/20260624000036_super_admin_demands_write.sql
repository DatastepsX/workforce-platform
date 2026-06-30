-- WFX-036: Give super_admin full write access to demands
-- Fix demands_insert/update/delete policies that were missing super_admin

BEGIN;

-- INSERT: add super_admin
DROP POLICY IF EXISTS "demands_insert" ON demands;
CREATE POLICY "demands_insert"
  ON public.demands FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND get_my_role() IN ('hiring_manager', 'recruiter', 'admin', 'super_admin')
  );

-- UPDATE: add super_admin
DROP POLICY IF EXISTS "demands_update" ON demands;
CREATE POLICY "demands_update"
  ON public.demands FOR UPDATE
  USING (
    created_by = auth.uid()
    OR get_my_role() IN ('recruiter', 'admin', 'super_admin')
  );

-- DELETE: add super_admin
DROP POLICY IF EXISTS "demands_delete" ON demands;
CREATE POLICY "demands_delete"
  ON public.demands FOR DELETE
  USING (get_my_role() IN ('admin', 'super_admin'));

-- Clean up stale notifications whose related demand no longer exists
DELETE FROM notifications
WHERE related_type = 'demand'
  AND related_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM demands WHERE id = related_id::uuid
  );

COMMIT;
