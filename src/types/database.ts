export type UserRole = 'admin' | 'hiring_manager' | 'recruiter' | 'candidate' | 'supplier';
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

export interface DemandSupplier {
  id: string;
  created_at: string;
  demand_id: string;
  supplier_id: string;
  sent_at: string;
  status: DemandSupplierStatus;
  deadline: string | null;
}
