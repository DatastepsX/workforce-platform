-- Add procurement and finance as first-class platform roles
-- Used as workflow approvers; get_my_role() returns these values for approval routing
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'procurement';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'finance';
