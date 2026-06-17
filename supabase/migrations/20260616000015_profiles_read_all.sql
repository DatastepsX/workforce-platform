-- Allow all authenticated users to read all profiles.
-- Needed so every role (hiring_manager, candidate, supplier) can see the
-- full user list — e.g. for the dev user switcher and future directory features.
-- Multiple SELECT policies on the same table work with OR logic in Supabase RLS.
CREATE POLICY "profiles_select_all_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
