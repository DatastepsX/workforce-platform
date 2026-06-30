-- WFX-037: demand_pending_review notification type + preassigned supplier status
BEGIN;
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'demand_pending_review';
ALTER TYPE demand_supplier_status ADD VALUE IF NOT EXISTS 'preassigned';
COMMIT;
