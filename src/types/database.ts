export type UserRole = 'super_admin' | 'admin' | 'hiring_manager' | 'recruiter' | 'candidate' | 'supplier' | 'procurement' | 'finance';
export type SeniorityLevel = 'junior' | 'mid' | 'senior' | 'lead';
export type AvailabilityType = 'immediate' | 'notice_period' | 'not_available';
export type RemotePreference = 'onsite' | 'hybrid' | 'remote' | 'flexible';
export type DemandStatus =
  | 'draft'
  | 'pending_review'
  | 'pending_approval'
  | 'sourcing'
  | 'screening'
  | 'interview'
  | 'award'
  | 'contracting'
  | 'filled'
  | 'on_hold'
  | 'cancelled'
  | 'rejected';
export type DemandPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ContractType = 'permanent' | 'freelance' | 'contractor' | 'internship';
export type CostItemContractType = 'perm' | 'temp' | 'contracting' | 'sow';
export type BillingPeriodType = 'weekly' | 'bi_weekly' | 'monthly' | 'milestone' | 'fixed';
export type AwardPeriodStatus = 'open' | 'submitted' | 'approved' | 'invoiced';
export type CostEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type CostEntryType = 'timesheet' | 'expense' | 'milestone' | 'fee';
export type BillingType = 'hourly' | 'daily' | 'fixed' | 'percentage' | 'milestone' | 'unit';
export type TaxTreatment = 'standard' | 'exempt' | 'reverse_charge' | 'zero_rated';
export type SapCostObjectType = 'cost_center' | 'wbs_element' | 'internal_order' | 'profit_center';
export type ComplianceSeverity = 'info' | 'warning' | 'error';
export type ValidationResult = 'passed' | 'warning' | 'failed';
export type SupplierStatus = 'active' | 'inactive';
export type DemandSupplierStatus = 'sent' | 'viewed' | 'submitted' | 'rejected' | 'preassigned';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  tenant_id: string | null;
  created_at: string;
}

export interface Demand {
  id: string;
  title: string;
  description: string | null;
  status: DemandStatus;
  priority: DemandPriority;
  contract_type: ContractType;
  location: string | null;
  remote_allowed: boolean;
  start_date: string | null;
  end_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  skills: string[];
  channels: string[];
  experience_years: number | null;
  approval_level: number | null;
  billing_period_type: BillingPeriodType | null;
  rate_type: string | null;
  tenant_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantRole {
  id: string;
  tenant_id: string;
  role_key: string;
  label: string;
  active: boolean;
  created_at: string;
}

export interface TenantConfig {
  id: string;
  tenant_id: string;
  // Demand workflow
  demand_msp_review: boolean;
  demand_approval_levels: number;
  demand_approval_role_l1: string | null;
  demand_approval_role_l2: string | null;
  demand_approval_role_l3: string | null;
  demand_msp_screening: boolean;
  // Award workflow
  award_msp_offer: boolean;
  award_approval_levels: number;
  award_approval_role_l1: string | null;
  award_approval_role_l2: string | null;
  award_approval_role_l3: string | null;
  award_po_step: boolean;
  // Cost item workflow
  cost_msp_review: boolean;
  cost_hm_approval: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProcessHistoryEntry {
  id: string;
  demand_id: string;
  from_status: string | null;
  to_status: string;
  action: string;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface TenantSupplier {
  id: string;
  tenant_id: string;
  supplier_id: string;
  active: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  created_at: string;
  company_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  specializations: string[];
  status: SupplierStatus;
  profile_id: string | null;
}

export interface CandidateProfile {
  id: string;
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  years_experience: number | null;
  seniority_level: SeniorityLevel | null;
  availability_date: string | null;
  availability_type: AvailabilityType;
  notice_period_weeks: number | null;
  location: string | null;
  remote_preference: RemotePreference;
  languages: string[];
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  currency: string;
  linkedin_url: string | null;
  portfolio_url: string | null;
  preferred_employment: string[];
  cv_path: string | null;
  updated_at: string;
  // Career Avatar fields
  avatar_visible_to_recruiters: boolean;
  career_goals: string | null;
  preferred_positions: string[];
  work_preferences: Record<string, unknown>;
  strengths: string | null;
  weaknesses: string | null;
  motivation: string | null;
  learning_willingness: number | null;
  avatar_summary: string | null;
  avatar_generated_at: string | null;
  avatar_status: AvatarStatus;
}

export type SubmissionStatus = 'proposed' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'awarded' | 'rejected';

export interface SupplierCandidate {
  id: string;
  created_at: string;
  supplier_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  headline: string | null;
  skills: string[];
  cv_path: string | null;
  notes: string | null;
  updated_at: string;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  currency: string | null;
  availability: string | null;
  location: string | null;
}

export interface CandidateSubmission {
  id: string;
  created_at: string;
  demand_id: string;
  supplier_id: string;
  supplier_candidate_id: string | null;
  candidate_profile_id: string | null;
  cv_path: string | null;
  candidate_name: string;
  candidate_email: string | null;
  notes: string | null;
  status: SubmissionStatus;
  source: 'supplier' | 'direct';
  submitted_at: string;
  proposed_rate: number | null;
  rate_type: string | null;
  ai_score: number | null;
  offer_status: 'pending' | 'accepted' | 'declined' | null;
  offer_note: string | null;
}

export interface DemandSupplier {
  id: string;
  created_at: string;
  demand_id: string;
  supplier_id: string;
  sent_at: string;
  status: DemandSupplierStatus;
  deadline: string | null;
}

export type EngagementStatus = 'active' | 'completed' | 'cancelled';

export type AwardStatus = 'pending_approval' | 'approved' | 'active' | 'completed' | 'cancelled';

export interface Award {
  id: string;
  demand_id: string | null;
  submission_id: string | null;
  supplier_id: string | null;
  tenant_id: string | null;
  candidate_name: string;
  candidate_email: string | null;
  supplier_name: string | null;
  demand_title: string;
  rate: number | null;
  rate_type: string | null;
  currency: string;
  total_amount: number | null;
  price_locked: boolean;
  start_date: string | null;
  end_date: string | null;
  status: AwardStatus;
  notes: string | null;
  po_number: string | null;
  billing_period_type: BillingPeriodType | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'x';
export type SocialPostStatus = 'draft' | 'approved' | 'posted' | 'archived' | 'rejected';

export interface SocialPost {
  id: string;
  demand_id: string;
  platform: SocialPlatform;
  status: SocialPostStatus;
  caption: string | null;
  hashtags: string[];
  image_path: string | null;
  tracking_code: string;
  tracking_url: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  external_post_url: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationType = 'new_submission' | 'submission_status' | 'engagement_created' | 'demand_received' | 'demand_created' | 'candidate_created' | 'supplier_created' | 'demand_pending_approval';

// ── Org Units ────────────────────────────────────────────────────────────────
export interface OrgUnit {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  active: boolean;
  position: number;
  created_at: string;
}

// ── Job Descriptions ─────────────────────────────────────────────────────────
export interface JobDescription {
  id: string;
  tenant_id: string;
  org_unit_id: string | null;
  title: string;
  description: string | null;
  skills: string[];
  contract_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  experience_years: number | null;
  seniority_level: string | null;
  location: string | null;
  remote_allowed: boolean;
  languages: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Supplier Categories (global) ─────────────────────────────────────────────
export interface SupplierCategory {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_id: string | null;
  related_type: string | null;
  read_at: string | null;
  created_at: string;
}

// ── Career Avatar ────────────────────────────────────────────────────────────

export const SOFT_SKILLS = [
  'communication', 'leadership', 'teamwork', 'analytical_thinking',
  'problem_solving', 'creativity', 'project_management', 'negotiation',
  'customer_orientation', 'data_analytics', 'presentation', 'organization',
] as const;

export type SoftSkill = typeof SOFT_SKILLS[number];

export const SOFT_SKILL_LABELS: Record<SoftSkill, string> = {
  communication: 'Kommunikation',
  leadership: 'Leadership',
  teamwork: 'Teamfähigkeit',
  analytical_thinking: 'Analytisches Denken',
  problem_solving: 'Problemlösung',
  creativity: 'Kreativität',
  project_management: 'Projektmanagement',
  negotiation: 'Verhandlungsgeschick',
  customer_orientation: 'Kundenorientierung',
  data_analytics: 'Data Analytics',
  presentation: 'Präsentationsfähigkeit',
  organization: 'Organisation',
};

export type AvatarStatus = 'none' | 'generating' | 'ready' | 'error';

export interface SoftSkillRating {
  id: string;
  candidate_profile_id: string;
  skill: SoftSkill;
  self_rating: number | null;
  ai_rating: number | null;
  updated_at: string;
}

export interface CareerLadder {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareerLadderStep {
  id: string;
  ladder_id: string;
  position: number;
  title: string;
  required_skills: string[];
  description: string | null;
}

export interface CareerPathStep {
  position: number;
  title: string;
  description: string;
  required_skills: string[];
  rationale: string;
  is_current?: boolean;
  estimated_duration_months?: number;
  open_demands_count?: number;
  matching_demand_ids?: string[];
}

export interface CandidateCareerPath {
  id: string;
  candidate_profile_id: string;
  base_ladder_id: string | null;
  path_type: 'ladder_based' | 'ai_custom';
  title: string | null;
  summary: string | null;
  steps: CareerPathStep[];
  generated_at: string;
  is_current: boolean;
}

export interface CareerRecommendation {
  type: 'course' | 'certification' | 'project' | 'mentoring';
  title: string;
  description: string;
  url?: string;
}

export interface CareerSkillGap {
  id: string;
  career_path_id: string;
  step_position: number;
  missing_skills: string[];
  recommendations: CareerRecommendation[];
  generated_at: string;
}

export interface SubmissionInterview {
  id: string;
  submission_id: string;
  demand_id: string;
  interviewer_name: string | null;
  interview_date: string | null;
  interview_type: 'video' | 'onsite' | 'phone' | 'technical' | 'hr';
  rating: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Cost Items ───────────────────────────────────────────────────────────────

export interface CostItemCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface CostItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  billing_type: BillingType | null;
  markup_eligible: boolean;
  pass_through: boolean;
  tax_treatment: TaxTreatment;
  sap_gl_account: string | null;
  sap_cost_object_type: SapCostObjectType | null;
  countries: string[];
  active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  // joined
  category?: CostItemCategory | null;
  contract_types?: CostItemContractType[];
}

// ── Compliance ───────────────────────────────────────────────────────────────

export interface ComplianceRule {
  id: string;
  name: string;
  description: string | null;
  country: string | null;
  contract_type: CostItemContractType | null;
  cost_item_id: string | null;
  effective_from: string | null;
  effective_to: string | null;
  severity: ComplianceSeverity;
  threshold: number | null;
  threshold_unit: string | null;
  validation_logic: string;
  override_allowed: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Award Periods ─────────────────────────────────────────────────────────────

export interface AwardPeriod {
  id: string;
  award_id: string;
  period_number: number;
  period_type: BillingPeriodType;
  label: string;
  start_date: string | null;
  end_date: string | null;
  status: AwardPeriodStatus;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  entries?: PeriodCostEntry[];
}

export interface PeriodCostEntry {
  id: string;
  period_id: string;
  award_id: string;
  cost_item_id: string | null;
  submitted_by: string | null;
  entry_type: CostEntryType;
  quantity: number;
  unit_price: number;
  amount: number;
  currency: string;
  description: string | null;
  notes: string | null;
  attachment_path: string | null;
  status: CostEntryStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined
  cost_item?: CostItem | null;
}

// ── Tenant Compliance Rule Overrides ──────────────────────────────────────────

export interface TenantComplianceRuleOverride {
  id: string;
  tenant_id: string;
  rule_id: string;
  active_override: boolean | null;
  threshold_override: number | null;
  severity_override: string | null;
  override_allowed_override: boolean | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface ComplianceValidationLog {
  id: string;
  rule_id: string | null;
  rule_snapshot: Record<string, unknown> | null;
  entity_type: string;
  entity_id: string | null;
  validation_result: ValidationResult;
  override_decision: boolean;
  override_reason: string | null;
  override_by: string | null;
  validated_by: string | null;
  validated_at: string;
  final_outcome: 'approved' | 'rejected' | 'pending' | null;
}

export interface Engagement {
  id: string;
  demand_id: string;
  submission_id: string | null;
  supplier_id: string | null;
  demand_title: string;
  candidate_name: string;
  candidate_email: string | null;
  supplier_name: string | null;
  start_date: string | null;
  end_date: string | null;
  rate: number | null;
  rate_type: string;
  currency: string;
  total_amount: number | null;
  price_locked: boolean;
  status: EngagementStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}
