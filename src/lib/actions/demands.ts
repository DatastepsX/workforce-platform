'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotifications } from '@/lib/actions/notifications';
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

  const channels = formData.getAll('channels') as string[];

  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();

  // Use profile tenant if set; otherwise take the explicitly selected tenant from the form
  const tenantId = profile?.tenant_id ?? (formData.get('tenant_id') as string | null) ?? null;
  if (!tenantId) throw new Error('A client must be selected for this demand.');

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
    channels,
    experience_years: formData.get('experience_years') ? Number(formData.get('experience_years')) : null,
    priority: formData.get('priority') as DemandPriority,
    status: 'draft' as DemandStatus,
    created_by: user.id,
    tenant_id: tenantId,
  }).select().single();

  if (error) throw new Error(error.message);

  // Log demand creation to process history
  try {
    const adminDb = createAdminClient();
    const { data: creator } = await adminDb.from('profiles').select('full_name, email, role').eq('id', user.id).single();
    await adminDb.from('process_history').insert({
      demand_id: data.id,
      from_status: null,
      to_status: 'draft',
      action: 'DEMAND_CREATED',
      actor_id: user.id,
      actor_role: creator?.role ?? null,
      actor_name: creator?.full_name || creator?.email || null,
      notes: null,
    });
  } catch { /* non-blocking */ }

  // Notify all recruiters/admins (except the creator) about new demand
  try {
    const adminDb = createAdminClient();
    const { data: targets } = await adminDb
      .from('profiles').select('id').in('role', ['recruiter', 'admin']);
    const ids = (targets ?? []).map(r => r.id).filter(id => id !== user.id);
    if (ids.length) {
      await createNotifications({
        userIds: ids,
        type: 'demand_created',
        title: `Neuer Demand: ${formData.get('title') as string}`,
        body: `Erstellt von ${user.email}`,
        relatedId: data.id,
        relatedType: 'demand',
      });
    }
  } catch (e) { console.error('[demands] notification block threw:', e); }

  revalidatePath('/dashboard/demands');
  redirect(`/dashboard/demands/${data.id}`);
}

export async function updateDemand(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const id = formData.get('id') as string;

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const { data: demand } = await supabase
    .from('demands').select('created_by').eq('id', id).single();
  const canEdit =
    demand?.created_by === user.id || ['admin', 'recruiter'].includes(profile?.role ?? '');
  if (!canEdit) redirect('/dashboard/demands');

  const skills = (formData.get('skills') as string)
    .split(',').map(s => s.trim()).filter(Boolean);

  const channels = formData.getAll('channels') as string[];

  const { error } = await supabase.from('demands').update({
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    contract_type: formData.get('contract_type') as ContractType,
    location: (formData.get('location') as string) || null,
    remote_allowed: formData.get('remote_allowed') === 'true',
    start_date: (formData.get('start_date') as string) || null,
    end_date: (formData.get('end_date') as string) || null,
    budget_min: formData.get('budget_min') ? Number(formData.get('budget_min')) : null,
    budget_max: formData.get('budget_max') ? Number(formData.get('budget_max')) : null,
    skills,
    channels,
    experience_years: formData.get('experience_years') ? Number(formData.get('experience_years')) : null,
    priority: formData.get('priority') as DemandPriority,
  }).eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/demands/${id}`);
  revalidatePath('/dashboard/demands');
  redirect(`/dashboard/demands/${id}`);
}

export async function deleteDemand(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard/demands');

  const id = formData.get('id') as string;
  await supabase.from('demand_suppliers').delete().eq('demand_id', id);
  const { error } = await supabase.from('demands').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/demands');
  redirect('/dashboard/demands');
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
