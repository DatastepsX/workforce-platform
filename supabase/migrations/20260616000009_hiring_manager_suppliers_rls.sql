-- Hiring manager can see suppliers and demand_supplier entries for their own demands

CREATE POLICY "suppliers_select_hiring_manager"
  ON public.suppliers FOR SELECT
  USING (
    public.get_my_role() = 'hiring_manager'
    AND EXISTS (
      SELECT 1 FROM public.demand_suppliers ds
      JOIN public.demands d ON d.id = ds.demand_id
      WHERE ds.supplier_id = suppliers.id
        AND d.created_by = auth.uid()
    )
  );

CREATE POLICY "demand_suppliers_select_hiring_manager"
  ON public.demand_suppliers FOR SELECT
  USING (
    public.get_my_role() = 'hiring_manager'
    AND EXISTS (
      SELECT 1 FROM public.demands d
      WHERE d.id = demand_id AND d.created_by = auth.uid()
    )
  );
