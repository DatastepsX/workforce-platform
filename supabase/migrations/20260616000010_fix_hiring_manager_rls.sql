-- Fix circular RLS: demands→suppliers→demands and demand_suppliers→demands→demand_suppliers
-- Solution: SECURITY DEFINER function that reads demands without triggering RLS

-- Drop problematic policies from migration 009 (safe even if 009 was never run)
DROP POLICY IF EXISTS "suppliers_select_hiring_manager"      ON public.suppliers;
DROP POLICY IF EXISTS "demand_suppliers_select_hiring_manager" ON public.demand_suppliers;

-- Helper: returns demand IDs owned by the calling user, bypassing RLS
CREATE OR REPLACE FUNCTION public.get_my_demand_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.demands WHERE created_by = auth.uid();
$$;

-- Hiring manager can read suppliers that are linked to their demands
CREATE POLICY "suppliers_select_hiring_manager"
  ON public.suppliers FOR SELECT
  USING (
    public.get_my_role() = 'hiring_manager'
    AND EXISTS (
      SELECT 1 FROM public.demand_suppliers ds
      WHERE ds.supplier_id = suppliers.id
        AND ds.demand_id = ANY(SELECT public.get_my_demand_ids())
    )
  );

-- Hiring manager can read demand_supplier rows for their demands
CREATE POLICY "demand_suppliers_select_hiring_manager"
  ON public.demand_suppliers FOR SELECT
  USING (
    public.get_my_role() = 'hiring_manager'
    AND demand_id = ANY(SELECT public.get_my_demand_ids())
  );
