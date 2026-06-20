import type { UserRole } from '@/types/database';
import type { ProcessStage, DemandProcessStatus, TransitionDef } from './types';

// ── Happy-path stage order (linear progression) ───────────────────────────────
export const STAGE_ORDER: ProcessStage[] = [
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
];

export const TERMINAL_STAGES: ProcessStage[] = ['CANCELLED', 'ON_HOLD', 'REJECTED'];

export const STAGE_LABELS: Record<ProcessStage, string> = {
  DRAFT:           'Entwurf',
  INTERNAL_REVIEW: 'Prüfung',
  SOURCING:        'Ausschreibung',
  SHORTLISTING:    'Vorauswahl',
  INTERVIEW:       'Interview',
  DECISION:        'Entscheidung',
  APPROVAL:        'Freigabe',
  ONBOARDING:      'Onboarding',
  ACTIVE:          'Aktiv',
  ENDED:           'Beendet',
  CANCELLED:       'Abgebrochen',
  ON_HOLD:         'Pausiert',
  REJECTED:        'Abgelehnt',
};

export const STATUS_LABELS: Record<DemandProcessStatus, string> = {
  REQUEST_DRAFT:             'Anfrage in Bearbeitung',
  PENDING_INTERNAL_REVIEW:   'Wartet auf interne Prüfung',
  RETURNED_FOR_REVISION:     'Zur Überarbeitung zurückgesendet',
  PUBLISHED_TO_SUPPLIERS:    'Bei Lieferanten ausgeschrieben',
  SUBMISSION_RECEIVED:       'Angebote eingegangen',
  UNDER_REVIEW:              'Angebote werden geprüft',
  SHORTLISTED:               'Kandidaten auf Shortlist',
  INTERVIEW_IN_PROGRESS:     'Interviews werden durchgeführt',
  DECISION_PENDING:          'Entscheidung ausstehend',
  CANDIDATE_SELECTED:        'Kandidat ausgewählt',
  PENDING_APPROVAL:          'Freigabe ausstehend',
  APPROVED:                  'Freigabe erteilt',
  ONBOARDING_IN_PROGRESS:    'Onboarding läuft',
  ACTIVE:                    'Beauftragung aktiv',
  ENDED:                     'Beauftragung beendet',
  CANCELLED:                 'Anfrage abgebrochen',
  ON_HOLD:                   'Prozess pausiert',
  REJECTED:                  'Anfrage abgelehnt',
};

export const STATUS_NEXT_STEP: Record<DemandProcessStatus, string> = {
  REQUEST_DRAFT:             'Anfrage vervollständigen und zur Prüfung einreichen',
  PENDING_INTERNAL_REVIEW:   'Prüfung durch Service Team ausstehend',
  RETURNED_FOR_REVISION:     'Anfrage überarbeiten und erneut einreichen',
  PUBLISHED_TO_SUPPLIERS:    'Angebote von Lieferanten abwarten',
  SUBMISSION_RECEIVED:       'Eingegangene Angebote prüfen und shortlisten',
  UNDER_REVIEW:              'Angebote prüfen und Shortlist erstellen',
  SHORTLISTED:               'Shortlist an Hiring Manager übermitteln, Interviews starten',
  INTERVIEW_IN_PROGRESS:     'Interviews durchführen und bewerten',
  DECISION_PENDING:          'Kandidat auswählen oder Interviews fortsetzen',
  CANDIDATE_SELECTED:        'Verfügbarkeit bestätigen und Freigabe einleiten',
  PENDING_APPROVAL:          'Freigabe durch Einkauf / Approver einholen',
  APPROVED:                  'Onboarding starten',
  ONBOARDING_IN_PROGRESS:    'Onboarding-Checklisten abarbeiten',
  ACTIVE:                    'Beauftragung läuft — Status bei Änderungen aktualisieren',
  ENDED:                     'Beauftragung abgeschlossen',
  CANCELLED:                 '—',
  ON_HOLD:                   'Prozess manuell wieder aufnehmen',
  REJECTED:                  '—',
};

export const STATUS_TO_STAGE: Record<DemandProcessStatus, ProcessStage> = {
  REQUEST_DRAFT:           'DRAFT',
  PENDING_INTERNAL_REVIEW: 'INTERNAL_REVIEW',
  RETURNED_FOR_REVISION:   'INTERNAL_REVIEW',
  PUBLISHED_TO_SUPPLIERS:  'SOURCING',
  SUBMISSION_RECEIVED:     'SHORTLISTING',
  UNDER_REVIEW:            'SHORTLISTING',
  SHORTLISTED:             'SHORTLISTING',
  INTERVIEW_IN_PROGRESS:   'INTERVIEW',
  DECISION_PENDING:        'DECISION',
  CANDIDATE_SELECTED:      'DECISION',
  PENDING_APPROVAL:        'APPROVAL',
  APPROVED:                'APPROVAL',
  ONBOARDING_IN_PROGRESS:  'ONBOARDING',
  ACTIVE:                  'ACTIVE',
  ENDED:                   'ENDED',
  CANCELLED:               'CANCELLED',
  ON_HOLD:                 'ON_HOLD',
  REJECTED:                'REJECTED',
};

export const OWNER_LABELS: Partial<Record<UserRole, string>> = {
  hiring_manager: 'Hiring Manager',
  recruiter:      'Service Team',
  admin:          'Admin',
  supplier:       'Lieferant',
  candidate:      'Kandidat',
};

// ── Transitions config ────────────────────────────────────────────────────────
// Format: from status → list of possible transitions
export const TRANSITIONS: Partial<Record<DemandProcessStatus, TransitionDef[]>> = {
  REQUEST_DRAFT: [
    {
      action: 'SUBMIT',
      label: 'Zur Prüfung einreichen',
      description: 'Anfrage wird durch Service Team geprüft',
      toStatus: 'PENDING_INTERNAL_REVIEW',
      toStage: 'INTERNAL_REVIEW',
      allowedRoles: ['hiring_manager', 'admin', 'recruiter'],
      ownerRole: 'recruiter',
      ownerLabel: 'Service Team',
      legacyStatus: 'draft',
    },
  ],

  PENDING_INTERNAL_REVIEW: [
    {
      action: 'APPROVE_AND_PUBLISH',
      label: 'Genehmigen & ausschreiben',
      description: 'Anfrage wird bei Lieferanten ausgeschrieben',
      toStatus: 'PUBLISHED_TO_SUPPLIERS',
      toStage: 'SOURCING',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: 'supplier',
      ownerLabel: 'Lieferant',
      legacyStatus: 'open',
    },
    {
      action: 'RETURN_FOR_REVISION',
      label: 'Zur Überarbeitung zurücksenden',
      description: 'Anfrage wird vom Hiring Manager überarbeitet',
      toStatus: 'RETURNED_FOR_REVISION',
      toStage: 'INTERNAL_REVIEW',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: 'hiring_manager',
      ownerLabel: 'Hiring Manager',
      requiresNote: true,
      legacyStatus: 'draft',
    },
    {
      action: 'REJECT',
      label: 'Ablehnen',
      description: 'Anfrage wird abgelehnt',
      toStatus: 'REJECTED',
      toStage: 'REJECTED',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: null,
      ownerLabel: null,
      isDangerous: true,
      requiresNote: true,
      legacyStatus: 'cancelled',
    },
  ],

  RETURNED_FOR_REVISION: [
    {
      action: 'RESUBMIT',
      label: 'Erneut einreichen',
      description: 'Überarbeitete Anfrage wird erneut geprüft',
      toStatus: 'PENDING_INTERNAL_REVIEW',
      toStage: 'INTERNAL_REVIEW',
      allowedRoles: ['hiring_manager', 'admin', 'recruiter'],
      ownerRole: 'recruiter',
      ownerLabel: 'Service Team',
      legacyStatus: 'draft',
    },
  ],

  PUBLISHED_TO_SUPPLIERS: [
    {
      action: 'START_REVIEW',
      label: 'Angebote prüfen',
      description: 'Eingegangene Angebote werden gesichtet',
      toStatus: 'SUBMISSION_RECEIVED',
      toStage: 'SHORTLISTING',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: 'recruiter',
      ownerLabel: 'Service Team',
      legacyStatus: 'open',
    },
  ],

  SUBMISSION_RECEIVED: [
    {
      action: 'REVIEW',
      label: 'Sichtung starten',
      description: 'Angebote werden detailliert geprüft',
      toStatus: 'UNDER_REVIEW',
      toStage: 'SHORTLISTING',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: 'recruiter',
      ownerLabel: 'Service Team',
      legacyStatus: 'open',
    },
  ],

  UNDER_REVIEW: [
    {
      action: 'SHORTLIST',
      label: 'Shortlist erstellen',
      description: 'Shortlist wird an Hiring Manager weitergegeben',
      toStatus: 'SHORTLISTED',
      toStage: 'SHORTLISTING',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: 'hiring_manager',
      ownerLabel: 'Hiring Manager',
      legacyStatus: 'open',
    },
  ],

  SHORTLISTED: [
    {
      action: 'START_INTERVIEWS',
      label: 'Interviews starten',
      description: 'Interviewtermine werden koordiniert',
      toStatus: 'INTERVIEW_IN_PROGRESS',
      toStage: 'INTERVIEW',
      allowedRoles: ['recruiter', 'admin', 'hiring_manager'],
      ownerRole: 'hiring_manager',
      ownerLabel: 'Hiring Manager',
      legacyStatus: 'open',
    },
  ],

  INTERVIEW_IN_PROGRESS: [
    {
      action: 'COMPLETE_INTERVIEWS',
      label: 'Interviews abschließen',
      description: 'Hiring Manager trifft Entscheidung',
      toStatus: 'DECISION_PENDING',
      toStage: 'DECISION',
      allowedRoles: ['recruiter', 'admin', 'hiring_manager'],
      ownerRole: 'hiring_manager',
      ownerLabel: 'Hiring Manager',
      legacyStatus: 'open',
    },
  ],

  DECISION_PENDING: [
    {
      action: 'SELECT_CANDIDATE',
      label: 'Kandidat ausgewählt',
      description: 'Verfügbarkeit wird durch Lieferant bestätigt',
      toStatus: 'CANDIDATE_SELECTED',
      toStage: 'DECISION',
      allowedRoles: ['recruiter', 'admin', 'hiring_manager'],
      ownerRole: 'supplier',
      ownerLabel: 'Lieferant',
      legacyStatus: 'open',
    },
  ],

  CANDIDATE_SELECTED: [
    {
      action: 'CONFIRM_AND_REQUEST_APPROVAL',
      label: 'Verfügbarkeit bestätigt → Freigabe einleiten',
      description: 'Freigabeprozess wird gestartet',
      toStatus: 'PENDING_APPROVAL',
      toStage: 'APPROVAL',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: 'admin',
      ownerLabel: 'Einkauf / Approver',
      legacyStatus: 'open',
    },
  ],

  PENDING_APPROVAL: [
    {
      action: 'GRANT_APPROVAL',
      label: 'Freigabe erteilen',
      description: 'Beauftragung wird vorbereitet',
      toStatus: 'APPROVED',
      toStage: 'APPROVAL',
      allowedRoles: ['admin', 'recruiter'],
      ownerRole: 'recruiter',
      ownerLabel: 'Service Team',
      legacyStatus: 'open',
    },
    {
      action: 'REJECT_APPROVAL',
      label: 'Freigabe verweigern',
      description: 'Anfrage wird abgelehnt',
      toStatus: 'REJECTED',
      toStage: 'REJECTED',
      allowedRoles: ['admin', 'recruiter'],
      ownerRole: null,
      ownerLabel: null,
      isDangerous: true,
      requiresNote: true,
      legacyStatus: 'cancelled',
    },
  ],

  APPROVED: [
    {
      action: 'START_ONBOARDING',
      label: 'Onboarding starten',
      description: 'Onboarding-Checklisten werden gestartet',
      toStatus: 'ONBOARDING_IN_PROGRESS',
      toStage: 'ONBOARDING',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: 'recruiter',
      ownerLabel: 'Service Team',
      legacyStatus: 'open',
    },
  ],

  ONBOARDING_IN_PROGRESS: [
    {
      action: 'COMPLETE_ONBOARDING',
      label: 'Onboarding abgeschlossen',
      description: 'Beauftragung ist aktiv',
      toStatus: 'ACTIVE',
      toStage: 'ACTIVE',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: null,
      ownerLabel: null,
      legacyStatus: 'open',
    },
  ],

  ACTIVE: [
    {
      action: 'END',
      label: 'Beauftragung beenden',
      description: 'Beauftragung wird als beendet markiert',
      toStatus: 'ENDED',
      toStage: 'ENDED',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: null,
      ownerLabel: null,
      legacyStatus: 'closed',
    },
  ],

  ON_HOLD: [
    {
      action: 'RESUME',
      label: 'Prozess fortsetzen',
      description: 'Prozess wird aus der Pause-Stellung fortgesetzt',
      toStatus: 'PUBLISHED_TO_SUPPLIERS', // default resume point
      toStage: 'SOURCING',
      allowedRoles: ['recruiter', 'admin'],
      ownerRole: 'recruiter',
      ownerLabel: 'Service Team',
      legacyStatus: 'open',
    },
  ],
};

// Universal transitions available from most active stages
export const UNIVERSAL_TRANSITIONS: TransitionDef[] = [
  {
    action: 'PUT_ON_HOLD',
    label: 'Pausieren',
    description: 'Prozess wird vorübergehend angehalten',
    toStatus: 'ON_HOLD',
    toStage: 'ON_HOLD',
    allowedRoles: ['recruiter', 'admin', 'hiring_manager'],
    ownerRole: 'recruiter',
    ownerLabel: 'Service Team',
    legacyStatus: 'on_hold',
  },
  {
    action: 'CANCEL',
    label: 'Abbrechen',
    description: 'Anfrage wird endgültig abgebrochen',
    toStatus: 'CANCELLED',
    toStage: 'CANCELLED',
    allowedRoles: ['recruiter', 'admin', 'hiring_manager'],
    ownerRole: null,
    ownerLabel: null,
    isDangerous: true,
    requiresNote: true,
    legacyStatus: 'cancelled',
  },
];

// Stages where universal transitions apply
const UNIVERSAL_TRANSITION_STAGES: ProcessStage[] = [
  'INTERNAL_REVIEW', 'SOURCING', 'SHORTLISTING',
  'INTERVIEW', 'DECISION', 'APPROVAL', 'ONBOARDING', 'ACTIVE',
];

// ── Helper functions ───────────────────────────────────────────────────────────

export function getStageIndex(stage: ProcessStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function isTerminalStage(stage: ProcessStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export function getTransitionsForStatus(
  status: DemandProcessStatus,
  role: UserRole,
): TransitionDef[] {
  const specific = (TRANSITIONS[status] ?? []).filter(t => t.allowedRoles.includes(role));
  const stage = STATUS_TO_STAGE[status];
  const universal = UNIVERSAL_TRANSITION_STAGES.includes(stage)
    ? UNIVERSAL_TRANSITIONS.filter(t => t.allowedRoles.includes(role))
    : [];
  return [...specific, ...universal];
}

// Derives process_stage + process_status from legacy demand.status for demands not yet migrated
export function inferProcessStatus(legacyStatus: string): { stage: ProcessStage; status: DemandProcessStatus } {
  switch (legacyStatus) {
    case 'draft':       return { stage: 'DRAFT',      status: 'REQUEST_DRAFT' };
    case 'open':        return { stage: 'SOURCING',   status: 'PUBLISHED_TO_SUPPLIERS' };
    case 'in_progress': return { stage: 'SHORTLISTING', status: 'SUBMISSION_RECEIVED' };
    case 'on_hold':     return { stage: 'ON_HOLD',    status: 'ON_HOLD' };
    case 'closed':      return { stage: 'ENDED',      status: 'ENDED' };
    case 'cancelled':   return { stage: 'CANCELLED',  status: 'CANCELLED' };
    default:            return { stage: 'DRAFT',      status: 'REQUEST_DRAFT' };
  }
}
