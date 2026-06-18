-- Add notification types for sidebar badges per section
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'demand_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'candidate_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'supplier_created';
