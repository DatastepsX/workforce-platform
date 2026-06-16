-- Distribution channels per demand
ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS channels TEXT[] NOT NULL DEFAULT '{suppliers}';

-- Update anon policy: only show demands with career_portal channel
DROP POLICY IF EXISTS "demands_public_read" ON public.demands;
CREATE POLICY "demands_public_read"
  ON public.demands FOR SELECT
  TO anon
  USING (status = 'open' AND 'career_portal' = ANY(channels));
