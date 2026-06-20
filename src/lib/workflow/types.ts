import type { UserRole } from '@/types/database';

// ── Stage: coarse, UI-visible process phase ───────────────────────────────────
export type ProcessStage =
  | 'DRAFT'
  | 'INTERNAL_REVIEW'
  | 'SOURCING'
  | 'SHORTLISTING'
  | 'INTERVIEW'
  | 'DECISION'
  | 'APPROVAL'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'ENDED'
  | 'CANCELLED'
  | 'ON_HOLD'
  | 'REJECTED';

// ── Status: granular technical state within a stage ───────────────────────────
export type DemandProcessStatus =
  | 'REQUEST_DRAFT'
  | 'PENDING_INTERNAL_REVIEW'
  | 'RETURNED_FOR_REVISION'
  | 'PUBLISHED_TO_SUPPLIERS'
  | 'SUBMISSION_RECEIVED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEW_IN_PROGRESS'
  | 'DECISION_PENDING'
  | 'CANDIDATE_SELECTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ONBOARDING_IN_PROGRESS'
  | 'ACTIVE'
  | 'ENDED'
  | 'CANCELLED'
  | 'ON_HOLD'
  | 'REJECTED';

export interface TransitionDef {
  action: string;
  label: string;
  description: string;
  toStatus: DemandProcessStatus;
  toStage: ProcessStage;
  allowedRoles: UserRole[];
  ownerRole: UserRole | null;
  ownerLabel: string | null;
  requiresNote?: boolean;
  isDangerous?: boolean;
  legacyStatus?: string;
}

export interface ProcessHistoryEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  from_stage: string | null;
  from_status: string | null;
  to_stage: string;
  to_status: string;
  action: string;
  actor_id: string | null;
  actor_role: string | null;
  notes: string | null;
  created_at: string;
}
