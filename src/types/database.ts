export type UserRole = 'admin' | 'hiring_manager' | 'recruiter' | 'candidate' | 'supplier';
export type DemandStatus = 'draft' | 'open' | 'in_progress' | 'on_hold' | 'closed' | 'cancelled';
export type DemandPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ContractType = 'permanent' | 'freelance' | 'contractor' | 'internship';

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
  experience_years: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DemandWithCreator extends Demand {
  creator: Pick<Profile, 'full_name' | 'email'> | null;
}
