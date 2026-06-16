-- Fix second RLS cycle:
-- demand_suppliers_select_supplier → suppliers RLS → suppliers_select_hiring_manager
-- → demand_suppliers → demand_suppliers_select_supplier → suppliers → ...
--
-- Solution: suppliers_select_hiring_manager uses a SECURITY DEFINER function
-- that reads demand_suppliers+demands directly, bypassing RLS entirely.

CREATE OR REPLACE FUNCTION public.get_my_supplier_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ds.supplier_id
  FROM public.demand_suppliers ds
  JOIN public.demands d ON d.id = ds.demand_id
  WHERE d.created_by = auth.uid();
$$;

DROP POLICY IF EXISTS "suppliers_select_hiring_manager" ON public.suppliers;

CREATE POLICY "suppliers_select_hiring_manager"
  ON public.suppliers FOR SELECT
  USING (
    public.get_my_role() = 'hiring_manager'
    AND id = ANY(SELECT public.get_my_supplier_ids())
  );
