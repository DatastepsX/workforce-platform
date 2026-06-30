-- ─── Org Units (per-client) ───────────────────────────────────────────────
CREATE TABLE org_units (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  active      boolean DEFAULT true NOT NULL,
  position    integer DEFAULT 0 NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ADD COLUMN org_unit_id uuid REFERENCES org_units(id) ON DELETE SET NULL;

-- ─── Job Descriptions (per-client, linked to org unit) ───────────────────
CREATE TABLE job_descriptions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  org_unit_id      uuid REFERENCES org_units(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  skills           text[] DEFAULT '{}' NOT NULL,
  contract_type    text,
  budget_min       numeric,
  budget_max       numeric,
  experience_years integer,
  seniority_level  text,
  location         text,
  remote_allowed   boolean DEFAULT false NOT NULL,
  languages        text[] DEFAULT '{}' NOT NULL,
  active           boolean DEFAULT true NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE demands ADD COLUMN job_description_id uuid REFERENCES job_descriptions(id) ON DELETE SET NULL;

-- ─── Supplier Categories (global / platform-level) ────────────────────────
CREATE TABLE supplier_categories (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  description text,
  active      boolean DEFAULT true NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE tenant_supplier_categories (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_category_id uuid NOT NULL REFERENCES supplier_categories(id) ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now() NOT NULL,
  UNIQUE (tenant_id, supplier_category_id)
);

CREATE TABLE supplier_category_members (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_category_id uuid NOT NULL REFERENCES supplier_categories(id) ON DELETE CASCADE,
  supplier_id          uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now() NOT NULL,
  UNIQUE (supplier_category_id, supplier_id)
);

CREATE TABLE jd_supplier_categories (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_description_id   uuid NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  supplier_category_id uuid NOT NULL REFERENCES supplier_categories(id) ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now() NOT NULL,
  UNIQUE (job_description_id, supplier_category_id)
);

-- RLS (see migration for full policies)
ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_supplier_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_category_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE jd_supplier_categories ENABLE ROW LEVEL SECURITY;
