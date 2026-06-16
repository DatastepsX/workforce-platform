export type UserRole = 'admin' | 'hiring_manager' | 'recruiter' | 'candidate' | 'supplier';
export type SeniorityLevel = 'junior' | 'mid' | 'senior' | 'lead';
export type AvailabilityType = 'immediate' | 'notice_period' | 'not_available';
export type RemotePreference = 'onsite' | 'hybrid' | 'remote' | 'flexible';
export type DemandStatus = 'draft' | 'open' | 'in_progress' | 'on_hold' | 'closed' | 'cancelled';
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
  created_by: string;
  created_at: string;
  updated_at: string;
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
