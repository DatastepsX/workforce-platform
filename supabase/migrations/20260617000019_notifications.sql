-- Notifications system
CREATE TYPE notification_type AS ENUM (
  'new_submission',       -- supplier/direct candidate submitted to a demand
  'submission_status',    -- submission status changed (for supplier/candidate)
  'engagement_created',   -- engagement commissioned (for supplier)
  'demand_received'       -- demand sent to supplier
);

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          notification_type NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  related_id    UUID,            -- demand_id, submission_id, engagement_id, etc.
  related_type  TEXT,            -- 'demand', 'submission', 'engagement'
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx    ON notifications(read_at) WHERE read_at IS NULL;

-- RLS: users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "service role can insert"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
