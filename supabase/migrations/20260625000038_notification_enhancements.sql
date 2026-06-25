-- WFX-038: Add missing notification types for full process coverage
BEGIN;
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'demand_returned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'award_pending_approval';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'demand_approved';
COMMIT;
