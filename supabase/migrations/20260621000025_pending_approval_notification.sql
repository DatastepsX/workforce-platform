-- Add demand_pending_approval to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'demand_pending_approval';
