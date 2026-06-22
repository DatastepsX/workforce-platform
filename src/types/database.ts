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
export type SupplierStatus = 'active' | 'inactive';
export type DemandSupplierStatus = 'sent' | 'viewed' | 'submitted' | 'rejected';

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

export type SubmissionStatus = 'proposed' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';

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
  submitted_at: string;
  proposed_rate: number | null;
  rate_type: string | null;
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
