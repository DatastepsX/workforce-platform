-- ============================================================
-- Demands
-- ============================================================

CREATE TYPE public.demand_status AS ENUM (
  'draft',
  'open',
  'in_progress',
  'on_hold',
  'closed',
  'cancelled'
);

CREATE TYPE public.demand_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE public.contract_type AS ENUM (
  'permanent',
  'freelance',
  'contractor',
  'internship'
);

CREATE TABLE public.demands (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  description      TEXT,
  status           public.demand_status   NOT NULL DEFAULT 'draft',
  priority         public.demand_priority NOT NULL DEFAULT 'medium',
  contract_type    public.contract_type   NOT NULL DEFAULT 'permanent',
  location         TEXT,
  remote_allowed   BOOLEAN     NOT NULL DEFAULT FALSE,
  start_date       DATE,
  end_date         DATE,
  budget_min       NUMERIC(10,2),
  budget_max       NUMERIC(10,2),
  skills           TEXT[]      NOT NULL DEFAULT '{}',
  experience_years INTEGER,
  created_by       UUID        NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER demands_set_updated_at
  BEFORE UPDATE ON public.demands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────

-- hiring_manager, recruiter, admin can create
CREATE POLICY "demands_insert"
  ON public.demands FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND public.get_my_role() IN ('hiring_manager', 'recruiter', 'admin')
  );

-- hiring_manager sees only own; recruiter + admin see all
CREATE POLICY "demands_select"
  ON public.demands FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.get_my_role() IN ('recruiter', 'admin')
  );

-- hiring_manager updates own; recruiter + admin update all
CREATE POLICY "demands_update"
  ON public.demands FOR UPDATE
  USING (
    created_by = auth.uid()
    OR public.get_my_role() IN ('recruiter', 'admin')
  );

-- only admin can delete
CREATE POLICY "demands_delete"
  ON public.demands FOR DELETE
  USING (public.get_my_role() = 'admin');
