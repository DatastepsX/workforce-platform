-- ============================================================
-- Profiles & Roles
-- ============================================================

CREATE TYPE public.user_role AS ENUM (
  'admin',
  'hiring_manager',
  'recruiter',
  'candidate',
  'supplier'
);

CREATE TABLE public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.user_role NOT NULL DEFAULT 'candidate',
  full_name  TEXT,
  email      TEXT,
  company    TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security-definer helper avoids RLS recursion when checking caller's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid();
$$;

-- Users can always read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin and recruiter can read every profile
CREATE POLICY "profiles_select_all_admin_recruiter"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() IN ('admin', 'recruiter'));

-- Users can update only their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'candidate');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
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
