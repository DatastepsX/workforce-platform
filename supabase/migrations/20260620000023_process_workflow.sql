-- Process workflow: stage + status + history on demands
-- Phase 1: data model only (UI + actions in app layer)

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE process_stage AS ENUM (
  'DRAFT',
  'INTERNAL_REVIEW',
  'SOURCING',
  'SHORTLISTING',
  'INTERVIEW',
  'DECISION',
  'APPROVAL',
  'ONBOARDING',
  'ACTIVE',
  'ENDED',
  'CANCELLED',
  'ON_HOLD',
  'REJECTED'
);

CREATE TYPE demand_process_status AS ENUM (
  'REQUEST_DRAFT',
  'PENDING_INTERNAL_REVIEW',
  'RETURNED_FOR_REVISION',
  'PUBLISHED_TO_SUPPLIERS',
  'SUBMISSION_RECEIVED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW_IN_PROGRESS',
  'DECISION_PENDING',
  'CANDIDATE_SELECTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ONBOARDING_IN_PROGRESS',
  'ACTIVE',
  'ENDED',
  'CANCELLED',
  'ON_HOLD',
  'REJECTED'
);

-- ── Add columns to demands ────────────────────────────────────────────────────

ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS process_stage    process_stage         NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS process_status   demand_process_status NOT NULL DEFAULT 'REQUEST_DRAFT',
  ADD COLUMN IF NOT EXISTS current_owner_role text                        DEFAULT NULL;

-- Populate from legacy status for existing rows
UPDATE demands SET
  process_stage = CASE status
    WHEN 'draft'        THEN 'DRAFT'::process_stage
    WHEN 'open'         THEN 'SOURCING'::process_stage
    WHEN 'in_progress'  THEN 'SHORTLISTING'::process_stage
    WHEN 'on_hold'      THEN 'ON_HOLD'::process_stage
    WHEN 'closed'       THEN 'ENDED'::process_stage
    WHEN 'cancelled'    THEN 'CANCELLED'::process_stage
    ELSE 'DRAFT'::process_stage
  END,
  process_status = CASE status
    WHEN 'draft'        THEN 'REQUEST_DRAFT'::demand_process_status
    WHEN 'open'         THEN 'PUBLISHED_TO_SUPPLIERS'::demand_process_status
    WHEN 'in_progress'  THEN 'SUBMISSION_RECEIVED'::demand_process_status
    WHEN 'on_hold'      THEN 'ON_HOLD'::demand_process_status
    WHEN 'closed'       THEN 'ENDED'::demand_process_status
    WHEN 'cancelled'    THEN 'CANCELLED'::demand_process_status
    ELSE 'REQUEST_DRAFT'::demand_process_status
  END;

-- ── Process history table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS process_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL DEFAULT 'demand',
  entity_id     uuid NOT NULL,
  from_stage    text,
  from_status   text,
  to_stage      text NOT NULL,
  to_status     text NOT NULL,
  action        text NOT NULL,
  actor_id      uuid REFERENCES auth.users(id),
  actor_role    text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS process_history_entity_idx ON process_history (entity_type, entity_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE process_history ENABLE ROW LEVEL SECURITY;

-- Admins + recruiters: full access
CREATE POLICY "admin_recruiter_all_process_history"
  ON process_history FOR ALL
  USING (get_my_role() IN ('admin', 'recruiter'));

-- Hiring managers: read history for their own demands
-- ARRAY(SELECT ...) wrapper needed because get_my_demand_ids() is a set-returning function,
-- which PostgreSQL forbids directly in policy expressions.
CREATE POLICY "hiring_manager_read_process_history"
  ON process_history FOR SELECT
  USING (
    get_my_role() = 'hiring_manager'
    AND entity_type = 'demand'
    AND entity_id = ANY(ARRAY(SELECT get_my_demand_ids()))
  );

-- Insert: hiring managers can log transitions for their own demands
CREATE POLICY "hiring_manager_insert_process_history"
  ON process_history FOR INSERT
  WITH CHECK (
    get_my_role() IN ('hiring_manager', 'admin', 'recruiter')
  );
