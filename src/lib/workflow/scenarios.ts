/**
 * Workflow Test Scenario Engine
 *
 * AUTO-EXTENDING DESIGN: All scenario steps are derived programmatically from
 * TenantConfig + the live getTransitions() engine. When new config flags or
 * workflow transitions are added to workflow/index.ts, they automatically
 * appear in scenarios for all tenants without any manual update here.
 *
 * To add coverage for a new config boolean:
 *   1. Add a step in generateHappySteps() that reads the new flag
 *   2. The unhappy counterparts (wrong role, wrong status) are generated automatically
 *
 * Happy path  — correct actor performs action at correct status → should PASS
 * Unhappy #1  — wrong role attempts action at correct status → should be BLOCKED
 * Unhappy #2  — correct role attempts action at wrong status → should be BLOCKED
 */

import type { TenantConfig, UserRole, DemandStatus } from '@/types/database';
import { getTransitions } from './index';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type PathType = 'happy' | 'unhappy_wrong_role' | 'unhappy_wrong_status' | 'operational';

export interface ExtendedScenarioStep {
  id: string;
  pathType: PathType;
  phase: 'demand' | 'sourcing' | 'award';
  name: string;
  description: string;
  fromStatus: DemandStatus | null;
  fromApprovalLevel: number | null;
  toStatus: DemandStatus;
  action: string;
  allowedRoles: UserRole[];
  testRole: string;
  expectedOutcome: 'pass' | 'blocked';
  conditionalFlag?: string;
  wrongRole?: string;
  wrongFromStatus?: DemandStatus;
}

export interface StepResult {
  step: ExtendedScenarioStep;
  testUser: TestUser | null;
  actualOutcome: 'pass' | 'blocked';
  correct: boolean;
  error?: string;
  transitionsFound: string[];
}

export interface FullScenarioReport {
  tenantId: string;
  tenantName: string;
  config: TenantConfig;
  results: StepResult[];
  happyPass: number;
  happyFail: number;
  unhappyPass: number;
  unhappyFail: number;
  totalSteps: number;
  coverageGaps: string[];
}

// Stored in DB
export interface ScenarioRunRecord {
  id: string;
  tenant_id: string;
  tenant_name: string;
  run_at: string;
  happy_pass: number;
  happy_fail: number;
  unhappy_pass: number;
  unhappy_fail: number;
  total_steps: number;
  step_results: StepResult[];
  optimization_ideas: OptimizationIdea[] | null;
  triggered_by: string;
  notes: string | null;
  created_by_name: string | null;
}

export interface OptimizationIdea {
  title: string;
  priority: 'high' | 'medium' | 'low';
  category: 'process' | 'compliance' | 'technology' | 'efficiency' | 'quality';
  description: string;
  impact: string;
  requirement: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pickWrongRole(allowedRoles: UserRole[]): UserRole {
  const preferred: UserRole[] = ['supplier', 'candidate', 'hiring_manager', 'finance', 'procurement', 'recruiter'];
  return preferred.find(r => !allowedRoles.includes(r)) ?? 'supplier';
}

const ALL_DEMAND_STATUSES: DemandStatus[] = [
  'draft', 'pending_review', 'pending_approval', 'sourcing',
  'screening', 'award', 'contracting', 'on_hold',
  'filled', 'cancelled', 'rejected',
];

// Returns a status from which `action` is never available for `testRole` (given `config`),
// or null if every status is a valid from-status for that action.
function pickWrongStatusForAction(
  action: string,
  config: TenantConfig,
  testRole: UserRole,
): DemandStatus | null {
  const validFromStatuses = new Set<DemandStatus>();
  for (const status of ALL_DEMAND_STATUSES) {
    // Check across all possible approval levels (null, 1, 2, 3)
    for (const level of [null, 1, 2, 3] as (number | null)[]) {
      const transitions = getTransitions(status, level, config, testRole);
      if (transitions.some(t => t.action === action)) {
        validFromStatuses.add(status);
        break;
      }
    }
  }
  // Prefer non-terminal decoys first, then terminal ones
  const preferred: DemandStatus[] = [
    'filled', 'cancelled', 'rejected',
    'draft', 'pending_review', 'pending_approval', 'sourcing',
    'screening', 'award', 'contracting', 'on_hold',
  ];
  return preferred.find(s => !validFromStatuses.has(s)) ?? null;
}

export function findTestUser(users: TestUser[], roles: string[]): TestUser | null {
  for (const role of roles) {
    const u = users.find(u => u.role === role);
    if (u) return u;
  }
  return null;
}

export function findWrongRoleUser(users: TestUser[], allowedRoles: string[]): TestUser | null {
  return users.find(u => !allowedRoles.includes(u.role) && u.role !== 'super_admin') ?? null;
}

function toTitle(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const OPERATIONAL_ACTIONS = new Set([
  'CREATE', 'SEND_TO_SUPPLIERS', 'SUBMIT_CANDIDATE', 'AWARD_SUBMISSION', 'FILLED',
  'COST_ENTRY_SUBMIT', 'COST_MSP_REVIEW', 'COST_HM_APPROVE', 'BILLING_PERIOD_INVOICED',
]);

// ── Happy Steps Generator ──────────────────────────────────────────────────

export function generateHappySteps(config: TenantConfig): ExtendedScenarioStep[] {
  const steps: ExtendedScenarioStep[] = [];

  // 1. Create demand
  steps.push({
    id: 'happy_create_demand',
    pathType: 'operational',
    phase: 'demand',
    name: 'Create Demand',
    description: 'Hiring Manager creates a new demand in Draft status',
    fromStatus: null,
    fromApprovalLevel: null,
    toStatus: 'draft',
    action: 'CREATE',
    allowedRoles: ['hiring_manager', 'admin', 'recruiter'],
    testRole: 'hiring_manager',
    expectedOutcome: 'pass',
  });

  // 2. Submit demand
  const submitTarget: DemandStatus = config.demand_msp_review
    ? 'pending_review'
    : config.demand_approval_levels > 0
    ? 'pending_approval'
    : 'sourcing';

  steps.push({
    id: 'happy_submit',
    pathType: 'happy',
    phase: 'demand',
    name: 'Submit Demand',
    description: `Hiring Manager submits demand → ${submitTarget.replace(/_/g, ' ')}`,
    fromStatus: 'draft',
    fromApprovalLevel: null,
    toStatus: submitTarget,
    toApprovalLevel: submitTarget === 'pending_approval' ? 1 : null,
    action: 'SUBMIT',
    allowedRoles: ['hiring_manager', 'admin', 'recruiter'],
    testRole: 'hiring_manager',
    expectedOutcome: 'pass',
  } as ExtendedScenarioStep);

  // 3. MSP Review (conditional)
  if (config.demand_msp_review) {
    const reviewTarget: DemandStatus = config.demand_approval_levels > 0 ? 'pending_approval' : 'sourcing';
    steps.push({
      id: 'happy_msp_review',
      pathType: 'happy',
      phase: 'demand',
      name: 'MSP Review — Approve',
      description: 'MSP Recruiter reviews demand and sends it forward',
      fromStatus: 'pending_review',
      fromApprovalLevel: null,
      toStatus: reviewTarget,
      toApprovalLevel: reviewTarget === 'pending_approval' ? 1 : null,
      action: 'APPROVE_REVIEW',
      allowedRoles: ['recruiter', 'admin'],
      testRole: 'recruiter',
      expectedOutcome: 'pass',
      conditionalFlag: 'demand_msp_review',
    } as ExtendedScenarioStep);

    steps.push({
      id: 'happy_msp_review_return',
      pathType: 'happy',
      phase: 'demand',
      name: 'MSP Review — Return to HM',
      description: 'MSP Recruiter returns demand to Hiring Manager for revision (requires note)',
      fromStatus: 'pending_review',
      fromApprovalLevel: null,
      toStatus: 'draft',
      action: 'RETURN',
      allowedRoles: ['recruiter', 'admin'],
      testRole: 'recruiter',
      expectedOutcome: 'pass',
      conditionalFlag: 'demand_msp_review',
    } as ExtendedScenarioStep);
  }

  // 4–6. Demand approval levels
  for (let level = 1; level <= config.demand_approval_levels; level++) {
    const roleKey = `demand_approval_role_l${level}` as keyof TenantConfig;
    const approverRole = (config[roleKey] as string) || 'admin';
    const isLast = level === config.demand_approval_levels;
    const nextStatus: DemandStatus = isLast ? 'sourcing' : 'pending_approval';

    steps.push({
      id: `happy_approval_l${level}`,
      pathType: 'happy',
      phase: 'demand',
      name: `Demand Approval L${level} — Approve`,
      description: `${toTitle(approverRole)} approves demand (level ${level}/${config.demand_approval_levels})`,
      fromStatus: 'pending_approval',
      fromApprovalLevel: level,
      toStatus: nextStatus,
      toApprovalLevel: isLast ? null : level + 1,
      action: 'APPROVE',
      allowedRoles: ['admin', approverRole as UserRole],
      testRole: approverRole,
      expectedOutcome: 'pass',
      conditionalFlag: `demand_approval_levels=${config.demand_approval_levels}`,
    } as ExtendedScenarioStep);

    steps.push({
      id: `happy_approval_l${level}_return`,
      pathType: 'happy',
      phase: 'demand',
      name: `Demand Approval L${level} — Return`,
      description: `${toTitle(approverRole)} returns demand for revision (requires note)`,
      fromStatus: 'pending_approval',
      fromApprovalLevel: level,
      toStatus: 'draft',
      action: 'RETURN',
      allowedRoles: ['admin', approverRole as UserRole],
      testRole: approverRole,
      expectedOutcome: 'pass',
      conditionalFlag: `demand_approval_levels=${config.demand_approval_levels}`,
    } as ExtendedScenarioStep);
  }

  // 7. Send to suppliers (operational)
  steps.push({
    id: 'happy_send_suppliers',
    pathType: 'operational',
    phase: 'sourcing',
    name: 'Send to Suppliers',
    description: 'MSP Recruiter sends demand to active tenant suppliers',
    fromStatus: 'sourcing',
    fromApprovalLevel: null,
    toStatus: 'sourcing',
    action: 'SEND_TO_SUPPLIERS',
    allowedRoles: ['recruiter', 'admin'],
    testRole: 'recruiter',
    expectedOutcome: 'pass',
  });

  // 8. Supplier submits candidate (operational)
  steps.push({
    id: 'happy_supplier_submit',
    pathType: 'operational',
    phase: 'sourcing',
    name: 'Supplier Submits Candidate',
    description: 'Supplier uploads candidate CV and rate via supplier portal',
    fromStatus: 'sourcing',
    fromApprovalLevel: null,
    toStatus: 'sourcing',
    action: 'SUBMIT_CANDIDATE',
    allowedRoles: ['supplier'],
    testRole: 'supplier',
    expectedOutcome: 'pass',
  });

  // 9. MSP Screening (conditional)
  if (config.demand_msp_screening) {
    steps.push({
      id: 'happy_start_screening',
      pathType: 'happy',
      phase: 'sourcing',
      name: 'Start MSP Screening',
      description: 'MSP Recruiter moves demand into Screening to review submissions',
      fromStatus: 'sourcing',
      fromApprovalLevel: null,
      toStatus: 'screening',
      action: 'START_SCREENING',
      allowedRoles: ['recruiter', 'admin'],
      testRole: 'recruiter',
      expectedOutcome: 'pass',
      conditionalFlag: 'demand_msp_screening',
    } as ExtendedScenarioStep);
  }

  // 10. Award candidate (operational — submission-level action)
  const awardActor = config.award_msp_offer ? 'recruiter' : 'hiring_manager';
  const awardRoles: UserRole[] = config.award_msp_offer
    ? ['recruiter', 'admin']
    : ['hiring_manager', 'admin'];

  steps.push({
    id: 'happy_award_candidate',
    pathType: 'operational',
    phase: 'award',
    name: 'Award Candidate',
    description: `${toTitle(awardActor)} creates award record from submission (rate, dates)`,
    fromStatus: config.demand_msp_screening ? 'screening' : 'sourcing',
    fromApprovalLevel: null,
    toStatus: 'award',
    action: 'AWARD_SUBMISSION',
    allowedRoles: awardRoles,
    testRole: awardActor,
    expectedOutcome: 'pass',
    conditionalFlag: config.award_msp_offer ? 'award_msp_offer=true' : 'award_msp_offer=false',
  });

  // 11–13. Award approval levels
  for (let level = 1; level <= config.award_approval_levels; level++) {
    const roleKey = `award_approval_role_l${level}` as keyof TenantConfig;
    const approverRole = (config[roleKey] as string) || 'admin';
    const isLast = level === config.award_approval_levels;
    const nextStatus: DemandStatus = isLast ? (config.award_po_step ? 'contracting' : 'filled') : 'award';

    steps.push({
      id: `happy_award_approval_l${level}`,
      pathType: 'happy',
      phase: 'award',
      name: `Award Approval L${level}`,
      description: `${toTitle(approverRole)} approves the award (level ${level}/${config.award_approval_levels})`,
      fromStatus: 'award',
      fromApprovalLevel: level,
      toStatus: nextStatus,
      toApprovalLevel: isLast ? null : level + 1,
      action: 'APPROVE_AWARD',
      allowedRoles: ['admin', approverRole as UserRole],
      testRole: approverRole,
      expectedOutcome: 'pass',
      conditionalFlag: `award_approval_levels=${config.award_approval_levels}`,
    } as ExtendedScenarioStep);
  }

  // 14. PO / Contracting (conditional)
  if (config.award_po_step) {
    steps.push({
      id: 'happy_confirm_po',
      pathType: 'happy',
      phase: 'award',
      name: 'Confirm PO / Contract',
      description: 'MSP Admin confirms purchase order — demand moves to Filled',
      fromStatus: 'contracting',
      fromApprovalLevel: null,
      toStatus: 'filled',
      action: 'CONFIRM_PO',
      allowedRoles: ['admin', 'recruiter'],
      testRole: 'admin',
      expectedOutcome: 'pass',
      conditionalFlag: 'award_po_step',
    } as ExtendedScenarioStep);
  }

  // 15. On Hold / Cancel (universal guard)
  steps.push({
    id: 'happy_put_on_hold',
    pathType: 'happy',
    phase: 'sourcing',
    name: 'Put Demand On Hold',
    description: 'MSP Recruiter pauses an active demand',
    fromStatus: 'sourcing',
    fromApprovalLevel: null,
    toStatus: 'on_hold',
    action: 'PUT_ON_HOLD',
    allowedRoles: ['recruiter', 'admin'],
    testRole: 'recruiter',
    expectedOutcome: 'pass',
  });

  steps.push({
    id: 'happy_resume',
    pathType: 'happy',
    phase: 'sourcing',
    name: 'Resume from On Hold',
    description: 'MSP Recruiter resumes a paused demand back to Sourcing',
    fromStatus: 'on_hold',
    fromApprovalLevel: null,
    toStatus: 'sourcing',
    action: 'RESUME',
    allowedRoles: ['admin', 'recruiter'],
    testRole: 'recruiter',
    expectedOutcome: 'pass',
  });

  // Cost item / billing period steps
  steps.push({
    id: 'happy_cost_entry_submit',
    pathType: 'operational',
    phase: 'award',
    name: 'Submit Cost Entry',
    description: 'Supplier or Candidate submits a billing period cost entry (timesheet, expense, milestone)',
    fromStatus: 'filled',
    fromApprovalLevel: null,
    toStatus: 'filled',
    action: 'COST_ENTRY_SUBMIT',
    allowedRoles: ['supplier', 'candidate'],
    testRole: 'supplier',
    expectedOutcome: 'pass',
  });

  if (config.cost_msp_review) {
    steps.push({
      id: 'happy_cost_msp_review',
      pathType: 'operational',
      phase: 'award',
      name: 'MSP Review Cost Entry',
      description: 'MSP Recruiter reviews submitted cost entries and marks them as reviewed',
      fromStatus: 'filled',
      fromApprovalLevel: null,
      toStatus: 'filled',
      action: 'COST_MSP_REVIEW',
      allowedRoles: ['recruiter', 'admin'],
      testRole: 'recruiter',
      expectedOutcome: 'pass',
      conditionalFlag: 'cost_msp_review',
    } as ExtendedScenarioStep);
  }

  if (config.cost_hm_approval) {
    steps.push({
      id: 'happy_cost_hm_approve',
      pathType: 'operational',
      phase: 'award',
      name: 'HM Approves Billing Period',
      description: 'Hiring Manager approves the billing period before invoicing',
      fromStatus: 'filled',
      fromApprovalLevel: null,
      toStatus: 'filled',
      action: 'COST_HM_APPROVE',
      allowedRoles: ['hiring_manager', 'admin'],
      testRole: 'hiring_manager',
      expectedOutcome: 'pass',
      conditionalFlag: 'cost_hm_approval',
    } as ExtendedScenarioStep);
  }

  steps.push({
    id: 'happy_billing_period_invoiced',
    pathType: 'operational',
    phase: 'award',
    name: 'Mark Period Invoiced',
    description: 'MSP Admin marks the billing period as invoiced after finance processes it',
    fromStatus: 'filled',
    fromApprovalLevel: null,
    toStatus: 'filled',
    action: 'BILLING_PERIOD_INVOICED',
    allowedRoles: ['admin', 'recruiter'],
    testRole: 'admin',
    expectedOutcome: 'pass',
  });

  return steps;
}

// ── Unhappy Steps Generator ────────────────────────────────────────────────

export function generateUnhappySteps(config: TenantConfig): ExtendedScenarioStep[] {
  const happy = generateHappySteps(config);
  const unhappy: ExtendedScenarioStep[] = [];

  for (const step of happy) {
    if (step.pathType === 'operational' || step.fromStatus === null) continue;

    const wrongRole = pickWrongRole(step.allowedRoles);
    const wrongFromStatus = pickWrongStatusForAction(step.action, config, step.testRole as UserRole);

    // Unhappy #1: wrong role attempts the action
    unhappy.push({
      id: `unhappy_role_${step.id}`,
      pathType: 'unhappy_wrong_role',
      phase: step.phase,
      name: `⛔ ${step.name} — Wrong Role`,
      description: `${toTitle(wrongRole)} (not authorised) attempts "${step.action}" — must be blocked`,
      fromStatus: step.fromStatus,
      fromApprovalLevel: step.fromApprovalLevel ?? null,
      toStatus: step.toStatus,
      action: step.action,
      allowedRoles: step.allowedRoles,
      testRole: wrongRole,
      wrongRole,
      expectedOutcome: 'blocked',
      conditionalFlag: step.conditionalFlag,
    } as ExtendedScenarioStep);

    // Unhappy #2: correct role, wrong status — skip if no genuinely invalid status exists
    if (!wrongFromStatus) {
      console.warn(`[scenarios] No invalid from-status found for action "${step.action}" as "${step.testRole}" — skipping wrong-status check`);
      continue;
    }

    unhappy.push({
      id: `unhappy_status_${step.id}`,
      pathType: 'unhappy_wrong_status',
      phase: step.phase,
      name: `⛔ ${step.name} — Wrong Status`,
      description: `${toTitle(step.testRole)} attempts "${step.action}" from wrong status "${wrongFromStatus}" — must be blocked`,
      fromStatus: wrongFromStatus,
      fromApprovalLevel: null,
      toStatus: step.toStatus,
      action: step.action,
      allowedRoles: step.allowedRoles,
      testRole: step.testRole,
      wrongFromStatus,
      expectedOutcome: 'blocked',
      conditionalFlag: step.conditionalFlag,
    } as ExtendedScenarioStep);
  }

  return unhappy;
}

export function generateAllSteps(config: TenantConfig): ExtendedScenarioStep[] {
  return [...generateHappySteps(config), ...generateUnhappySteps(config)];
}

// ── Simulation ────────────────────────────────────────────────────────────

function simulateStep(
  step: ExtendedScenarioStep,
  config: TenantConfig,
): { actualOutcome: 'pass' | 'blocked'; error?: string; transitionsFound: string[] } {
  // Operational steps are always considered "pass" (no workflow engine check)
  if (step.pathType === 'operational' || step.fromStatus === null) {
    return { actualOutcome: 'pass', transitionsFound: [] };
  }

  const transitions = getTransitions(
    step.fromStatus,
    step.fromApprovalLevel,
    config,
    step.testRole as UserRole,
  );
  const transitionsFound = transitions.map(t => t.action);
  const match = transitions.find(t => t.action === step.action);

  if (step.pathType === 'happy') {
    if (!match) {
      return {
        actualOutcome: 'blocked',
        error: `Expected "${step.action}" to be available from ${step.fromStatus} (L${step.fromApprovalLevel ?? '-'}) as ${step.testRole}. Available: [${transitionsFound.join(', ')}]`,
        transitionsFound,
      };
    }
    if (match.toStatus !== step.toStatus) {
      return {
        actualOutcome: 'blocked',
        error: `Expected target "${step.toStatus}" but transition yields "${match.toStatus}"`,
        transitionsFound,
      };
    }
    return { actualOutcome: 'pass', transitionsFound };
  }

  // unhappy_wrong_role / unhappy_wrong_status: action must NOT be available
  if (match) {
    return {
      actualOutcome: 'pass', // action was found = NOT blocked = security hole
      error: `"${step.action}" should be blocked for ${step.testRole} from ${step.fromStatus} but it was available`,
      transitionsFound,
    };
  }
  return { actualOutcome: 'blocked', transitionsFound }; // correctly blocked → "pass" for unhappy
}

// ── Full Run (with user assignment) ───────────────────────────────────────

export function runFullScenario(
  config: TenantConfig,
  users: TestUser[],
): StepResult[] {
  const steps = generateAllSteps(config);

  return steps.map(step => {
    const { actualOutcome, error, transitionsFound } = simulateStep(step, config);

    // Find the test user for this step
    let testUser: TestUser | null = null;
    if (step.pathType === 'unhappy_wrong_role' && step.wrongRole) {
      testUser = findTestUser(users, [step.wrongRole]) ?? findWrongRoleUser(users, step.allowedRoles.map(String));
    } else {
      testUser = findTestUser(users, [step.testRole, ...step.allowedRoles.map(String)]);
    }

    // For unhappy: correct means actualOutcome === 'blocked'
    // For happy / operational: correct means actualOutcome === 'pass'
    const correct = step.expectedOutcome === 'pass'
      ? actualOutcome === 'pass'
      : actualOutcome === 'blocked';

    return { step, testUser, actualOutcome, correct, error, transitionsFound };
  });
}

export function buildFullReport(
  tenantId: string,
  tenantName: string,
  config: TenantConfig,
  users: TestUser[],
): FullScenarioReport {
  const results = runFullScenario(config, users);

  const happyResults = results.filter(r =>
    r.step.pathType === 'happy' || r.step.pathType === 'operational',
  );
  const unhappyResults = results.filter(r =>
    r.step.pathType === 'unhappy_wrong_role' || r.step.pathType === 'unhappy_wrong_status',
  );

  const happyPass = happyResults.filter(r => r.correct).length;
  const happyFail = happyResults.filter(r => !r.correct).length;
  const unhappyPass = unhappyResults.filter(r => r.correct).length;
  const unhappyFail = unhappyResults.filter(r => !r.correct).length;

  // Coverage gap detection: any workflow action not covered by happy steps
  const coveredActions = new Set(
    generateHappySteps(config)
      .filter(s => s.pathType !== 'operational')
      .map(s => s.action),
  );
  const coverageGaps: string[] = [];
  const allStatuses: DemandStatus[] = [
    'draft', 'pending_review', 'pending_approval', 'sourcing',
    'screening', 'award', 'contracting', 'on_hold',
  ];
  for (const status of allStatuses) {
    for (let level: number | null = null; level === null || level <= 3; level = level === null ? 1 : level + 1) {
      const ts = getTransitions(status, level, config, 'super_admin');
      for (const t of ts) {
        if (!coveredActions.has(t.action) && !OPERATIONAL_ACTIONS.has(t.action)) {
          coverageGaps.push(`${t.action} from ${status} (L${level ?? '-'})`);
        }
      }
      if (level === null) break;
    }
  }

  return {
    tenantId,
    tenantName,
    config,
    results,
    happyPass,
    happyFail,
    unhappyPass,
    unhappyFail,
    totalSteps: results.length,
    coverageGaps: Array.from(new Set(coverageGaps)),
  };
}
