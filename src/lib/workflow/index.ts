import type { DemandStatus, UserRole, TenantConfig } from '@/types/database';

// ── Labels ────────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<DemandStatus, string> = {
  draft:            'Draft',
  pending_review:   'Pending MSP Review',
  pending_approval: 'Pending Approval',
  sourcing:         'Sourcing',
  screening:        'Screening',
  interview:        'Interview',
  award:            'Award',
  contracting:      'Contracting',
  filled:           'Filled',
  on_hold:          'On Hold',
  cancelled:        'Cancelled',
  rejected:         'Rejected',
};

export const STATUS_COLORS: Record<DemandStatus, string> = {
  draft:            '#8E8E93',
  pending_review:   '#FF9500',
  pending_approval: '#FF9500',
  sourcing:         '#007AFF',
  screening:        '#007AFF',
  interview:        '#5856D6',
  award:            '#34C759',
  contracting:      '#34C759',
  filled:           '#34C759',
  on_hold:          '#FF9500',
  cancelled:        '#FF3B30',
  rejected:         '#FF3B30',
};

// The 7 visible phases shown in the stepper (in order)
export const PHASE_ORDER: DemandStatus[] = [
  'draft', 'pending_review', 'pending_approval',
  'sourcing', 'screening', 'interview',
  'award', 'contracting', 'filled',
];

export const PHASE_LABELS: Partial<Record<DemandStatus, string>> = {
  draft:            'Draft',
  pending_review:   'MSP Review',
  pending_approval: 'Approval',
  sourcing:         'Sourcing',
  screening:        'Screening',
  interview:        'Interview',
  award:            'Award',
  contracting:      'Contracting',
  filled:           'Filled',
};

export const TERMINAL_STATUSES: DemandStatus[] = ['filled', 'cancelled', 'rejected'];
export const ACTIVE_SOURCING_STATUSES: DemandStatus[] = ['sourcing', 'screening', 'interview'];

// ── Transition definitions ────────────────────────────────────────────────────

export interface TransitionDef {
  action: string;
  label: string;
  toStatus: DemandStatus;
  toApprovalLevel?: number | null;
  allowedRoles: UserRole[];
  requiresNote?: boolean;
  isDangerous?: boolean;
  description?: string;
}

// Build transitions dynamically based on tenant config
export function getTransitions(
  status: DemandStatus,
  approvalLevel: number | null,
  config: TenantConfig,
  role: UserRole,
): TransitionDef[] {
  const all = allTransitions(status, approvalLevel, config);
  return all.filter(t => t.allowedRoles.includes(role));
}

function allTransitions(
  status: DemandStatus,
  approvalLevel: number | null,
  config: TenantConfig,
): TransitionDef[] {
  // Universal danger transitions (from any active non-terminal status)
  const universalDanger: TransitionDef[] = [
    {
      action: 'CANCEL',
      label: 'Cancel',
      toStatus: 'cancelled',
      allowedRoles: ['admin', 'recruiter', 'hiring_manager'],
      isDangerous: true,
      requiresNote: true,
    },
    {
      action: 'PUT_ON_HOLD',
      label: 'Put on Hold',
      toStatus: 'on_hold',
      allowedRoles: ['admin', 'recruiter'],
    },
  ];

  switch (status) {
    case 'draft': {
      // Where does "Submit" go? Depends on config
      const toStatus = config.demand_msp_review
        ? 'pending_review'
        : config.demand_approval_levels > 0
        ? 'pending_approval'
        : 'sourcing';
      return [
        {
          action: 'SUBMIT',
          label: 'Submit for Review',
          toStatus,
          toApprovalLevel: toStatus === 'pending_approval' ? 1 : null,
          allowedRoles: ['hiring_manager', 'admin', 'recruiter'],
          description: 'Submit this demand to start the approval process',
        },
      ];
    }

    case 'pending_review': {
      const toStatus = config.demand_approval_levels > 0 ? 'pending_approval' : 'sourcing';
      return [
        {
          action: 'APPROVE_REVIEW',
          label: config.demand_approval_levels > 0 ? 'Approve & Send for Approval' : 'Approve & Publish',
          toStatus,
          toApprovalLevel: toStatus === 'pending_approval' ? 1 : null,
          allowedRoles: ['recruiter', 'admin'],
          description: 'Demand passes MSP review',
        },
        {
          action: 'RETURN',
          label: 'Return to Hiring Manager',
          toStatus: 'draft',
          allowedRoles: ['recruiter', 'admin'],
          requiresNote: true,
          description: 'Send back for revisions',
        },
        {
          action: 'REJECT',
          label: 'Reject',
          toStatus: 'rejected',
          allowedRoles: ['recruiter', 'admin'],
          isDangerous: true,
          requiresNote: true,
        },
        ...universalDanger.filter(t => t.action === 'CANCEL'),
      ];
    }

    case 'pending_approval': {
      const level = approvalLevel ?? 1;
      const isLastLevel = level >= config.demand_approval_levels;
      const nextStatus = isLastLevel ? 'sourcing' : 'pending_approval';
      const nextLevel = isLastLevel ? null : level + 1;
      return [
        {
          action: 'APPROVE',
          label: isLastLevel ? 'Approve & Publish' : `Approve (Level ${level} of ${config.demand_approval_levels})`,
          toStatus: nextStatus,
          toApprovalLevel: nextLevel,
          allowedRoles: ['hiring_manager', 'admin', 'recruiter'],
          description: isLastLevel ? 'Final approval — demand goes live to suppliers' : 'Approve and forward to next approver',
        },
        {
          action: 'RETURN',
          label: 'Return for Revision',
          toStatus: 'draft',
          allowedRoles: ['hiring_manager', 'admin', 'recruiter'],
          requiresNote: true,
        },
        {
          action: 'REJECT',
          label: 'Reject',
          toStatus: 'rejected',
          allowedRoles: ['admin', 'recruiter'],
          isDangerous: true,
          requiresNote: true,
        },
        ...universalDanger.filter(t => t.action === 'CANCEL'),
      ];
    }

    case 'sourcing':
      return [
        {
          action: 'START_SCREENING',
          label: config.demand_msp_screening ? 'Start Screening' : 'Review Submissions',
          toStatus: 'screening',
          allowedRoles: config.demand_msp_screening
            ? ['recruiter', 'admin']
            : ['recruiter', 'admin', 'hiring_manager'],
          description: 'Move to review incoming submissions',
        },
        ...universalDanger,
      ];

    case 'screening':
      return [
        {
          action: 'START_INTERVIEWS',
          label: 'Move to Interview',
          toStatus: 'interview',
          allowedRoles: ['recruiter', 'admin', 'hiring_manager'],
          description: 'Shortlist complete — start interviews',
        },
        {
          action: 'BACK_TO_SOURCING',
          label: 'Back to Sourcing',
          toStatus: 'sourcing',
          allowedRoles: ['recruiter', 'admin'],
          description: 'Need more candidates — reopen to suppliers',
        },
        ...universalDanger,
      ];

    case 'interview':
      return [
        {
          action: 'SELECT_CANDIDATE',
          label: 'Select Candidate',
          toStatus: 'award',
          toApprovalLevel: config.award_approval_levels > 0 ? 1 : null,
          allowedRoles: ['hiring_manager', 'admin', 'recruiter'],
          description: 'Candidate chosen — start award process',
        },
        {
          action: 'BACK_TO_SCREENING',
          label: 'Back to Screening',
          toStatus: 'screening',
          allowedRoles: ['recruiter', 'admin'],
          description: 'No suitable candidate — re-evaluate shortlist',
        },
        ...universalDanger,
      ];

    case 'award': {
      const level = approvalLevel ?? 1;
      const isLastLevel = level >= config.award_approval_levels || config.award_approval_levels === 0;
      const nextStatus = isLastLevel
        ? (config.award_po_step ? 'contracting' : 'filled')
        : 'award';
      const nextLevel = isLastLevel ? null : level + 1;
      return [
        {
          action: 'APPROVE_AWARD',
          label: isLastLevel
            ? (config.award_po_step ? 'Approve & Create PO' : 'Confirm Placement')
            : `Approve Award (Level ${level} of ${config.award_approval_levels})`,
          toStatus: nextStatus,
          toApprovalLevel: nextLevel,
          allowedRoles: ['admin', 'recruiter', 'hiring_manager'],
          description: 'Approve the award and move forward',
        },
        ...universalDanger,
      ];
    }

    case 'contracting':
      return [
        {
          action: 'CONFIRM_PO',
          label: 'PO Confirmed — Mark as Filled',
          toStatus: 'filled',
          allowedRoles: ['admin', 'recruiter'],
          description: 'Purchase order signed, contractor confirmed',
        },
        ...universalDanger,
      ];

    case 'on_hold':
      return [
        {
          action: 'RESUME',
          label: 'Resume',
          toStatus: 'sourcing',
          allowedRoles: ['admin', 'recruiter'],
          description: 'Reactivate and resume sourcing',
        },
        {
          action: 'CANCEL',
          label: 'Cancel',
          toStatus: 'cancelled',
          allowedRoles: ['admin', 'recruiter', 'hiring_manager'],
          isDangerous: true,
          requiresNote: true,
        },
      ];

    default:
      return [];
  }
}

export function isTerminal(status: DemandStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isActive(status: DemandStatus): boolean {
  return !isTerminal(status) && status !== 'on_hold';
}

// Which statuses count as "publicly open" for the career portal
export function isPubliclyVisible(status: DemandStatus): boolean {
  return ACTIVE_SOURCING_STATUSES.includes(status);
}
