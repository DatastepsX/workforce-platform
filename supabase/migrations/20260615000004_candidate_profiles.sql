-- ── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE seniority_level    AS ENUM ('junior', 'mid', 'senior', 'lead');
CREATE TYPE availability_type  AS ENUM ('immediate', 'notice_period', 'not_available');
CREATE TYPE remote_preference  AS ENUM ('onsite', 'hybrid', 'remote', 'flexible');

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE candidate_profiles (
  id                   uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  headline             text,
  bio                  text,
  skills               text[]           NOT NULL DEFAULT '{}',
  years_experience     integer,
  seniority_level      seniority_level,
  availability_date    date,
  availability_type    availability_type NOT NULL DEFAULT 'not_available',
  notice_period_weeks  integer,
  location             text,
  remote_preference    remote_preference NOT NULL DEFAULT 'flexible',
  languages            text[]           NOT NULL DEFAULT '{}',
  hourly_rate_min      numeric,
  hourly_rate_max      numeric,
  currency             text             NOT NULL DEFAULT 'EUR',
  linkedin_url         text,
  portfolio_url        text,
  preferred_employment text[]           NOT NULL DEFAULT '{}',
  cv_path              text,
  updated_at           timestamptz      NOT NULL DEFAULT now()
);

CREATE TRIGGER set_candidate_profiles_updated_at
  BEFORE UPDATE ON candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_own_profile"
  ON candidate_profiles FOR ALL
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "recruiter_admin_read"
  ON candidate_profiles FOR SELECT
  USING (get_my_role() IN ('recruiter', 'admin'));

-- ── Storage bucket ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cvs', 'cvs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "cv_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cvs' AND
    auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "cv_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cvs' AND
    auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "cv_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cvs' AND
    auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "cv_read_access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs' AND (
      auth.uid()::text = split_part(name, '/', 1) OR
      get_my_role() IN ('recruiter', 'admin')
    )
  );
