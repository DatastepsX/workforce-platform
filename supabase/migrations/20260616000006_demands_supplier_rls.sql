-- Allow suppliers to read demands that were sent to them
CREATE POLICY "demands_select_supplier"
  ON public.demands FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.demand_suppliers ds
      JOIN public.suppliers s ON s.id = ds.supplier_id
      WHERE ds.demand_id = demands.id
        AND s.profile_id = auth.uid()
    )
  );
