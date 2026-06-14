-- ============================================================
-- Suppliers
-- ============================================================

CREATE TYPE public.supplier_status AS ENUM ('active', 'inactive');

CREATE TABLE public.suppliers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_name     TEXT        NOT NULL,
  contact_name     TEXT,
  email            TEXT        NOT NULL,
  phone            TEXT,
  specializations  TEXT[]      NOT NULL DEFAULT '{}',
  status           public.supplier_status NOT NULL DEFAULT 'active',
  profile_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Admin + recruiter: full access
CREATE POLICY "suppliers_admin_recruiter"
  ON public.suppliers FOR ALL
  USING (public.get_my_role() IN ('admin', 'recruiter'))
  WITH CHECK (public.get_my_role() IN ('admin', 'recruiter'));

-- Supplier user can read own record
CREATE POLICY "suppliers_select_own"
  ON public.suppliers FOR SELECT
  USING (profile_id = auth.uid());

-- ============================================================
-- Demand ↔ Supplier junction
-- ============================================================

CREATE TYPE public.demand_supplier_status AS ENUM (
  'sent',
  'viewed',
  'submitted',
  'rejected'
);

CREATE TABLE public.demand_suppliers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  demand_id   UUID        NOT NULL REFERENCES public.demands(id)   ON DELETE CASCADE,
  supplier_id UUID        NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      public.demand_supplier_status NOT NULL DEFAULT 'sent',
  deadline    TIMESTAMPTZ,
  UNIQUE (demand_id, supplier_id)
);

ALTER TABLE public.demand_suppliers ENABLE ROW LEVEL SECURITY;

-- Admin + recruiter: full access
CREATE POLICY "demand_suppliers_admin_recruiter"
  ON public.demand_suppliers FOR ALL
  USING (public.get_my_role() IN ('admin', 'recruiter'))
  WITH CHECK (public.get_my_role() IN ('admin', 'recruiter'));

-- Supplier user: read own entries
CREATE POLICY "demand_suppliers_select_supplier"
  ON public.demand_suppliers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = demand_suppliers.supplier_id
        AND s.profile_id = auth.uid()
    )
  );

-- Supplier user: update own status (e.g. viewed, rejected)
CREATE POLICY "demand_suppliers_update_supplier"
  ON public.demand_suppliers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = demand_suppliers.supplier_id
        AND s.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = demand_suppliers.supplier_id
        AND s.profile_id = auth.uid()
    )
  );
