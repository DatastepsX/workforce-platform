'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { DemandStatus, DemandPriority, ContractType } from '@/types/database';

export interface CreateDemandInput {
  title: string;
  description: string;
  contract_type: ContractType;
  location: string;
  remote_allowed: boolean;
  start_date: string;
  end_date: string;
  budget_min: string;
  budget_max: string;
  skills: string;
  experience_years: string;
  priority: DemandPriority;
}

export async function createDemand(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const skills = (formData.get('skills') as string)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const { data, error } = await supabase.from('demands').insert({
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    contract_type: formData.get('contract_type') as ContractType,
    location: formData.get('location') as string || null,
    remote_allowed: formData.get('remote_allowed') === 'true',
    start_date: (formData.get('start_date') as string) || null,
    end_date: (formData.get('end_date') as string) || null,
    budget_min: formData.get('budget_min') ? Number(formData.get('budget_min')) : null,
    budget_max: formData.get('budget_max') ? Number(formData.get('budget_max')) : null,
    skills,
    experience_years: formData.get('experience_years') ? Number(formData.get('experience_years')) : null,
    priority: formData.get('priority') as DemandPriority,
    status: 'draft' as DemandStatus,
    created_by: user.id,
  }).select().single();

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/demands');
  redirect(`/dashboard/demands/${data.id}`);
}

export async function updateDemandStatus(id: string, status: DemandStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('demands')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/demands/${id}`);
  revalidatePath('/dashboard/demands');
}
