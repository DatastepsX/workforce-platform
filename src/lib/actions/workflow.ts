'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTransitions } from '@/lib/workflow';
import type { DemandStatus, UserRole, TenantConfig } from '@/types/database';

async function getDefaultConfig(admin: ReturnType<typeof createAdminClient>): Promise<TenantConfig> {
  const { data } = await admin
    .from('tenant_configs')
    .select('*')
    .limit(1)
    .single();
  return data as TenantConfig;
}

export async function transitionDemandStatus(
  demandId: string,
  action: string,
  notes?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role as UserRole | undefined;
  if (!role) return { error: 'Role not found' };

  const admin = createAdminClient();

  const { data: demand } = await admin
    .from('demands')
    .select('status, approval_level, created_by')
    .eq('id', demandId)
    .single();
  if (!demand) return { error: 'Demand not found' };

  const config = await getDefaultConfig(admin);
  if (!config) return { error: 'Tenant config not found' };

  const currentStatus = demand.status as DemandStatus;
  const approvalLevel = demand.approval_level as number | null;

  const transitions = getTransitions(currentStatus, approvalLevel, config, role);
  const transition = transitions.find(t => t.action === action);

  if (!transition) return { error: 'Action not allowed' };
  if (transition.requiresNote && !notes?.trim()) return { error: 'A note is required for this action' };

  const { error: updateError } = await admin
    .from('demands')
    .update({
      status: transition.toStatus,
      approval_level: transition.toApprovalLevel ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', demandId);

  if (updateError) return { error: updateError.message };

  await admin.from('process_history').insert({
    demand_id: demandId,
    from_status: currentStatus,
    to_status: transition.toStatus,
    action,
    actor_id: user.id,
    actor_role: role,
    notes: notes?.trim() || null,
  });

  revalidatePath(`/dashboard/demands/${demandId}`);
  revalidatePath('/dashboard/demands');

  return {};
}

export async function getDemandHistory(demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('process_history')
    .select('*')
    .eq('demand_id', demandId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getDefaultTenantConfig(): Promise<TenantConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenant_configs')
    .select('*')
    .limit(1)
    .single();
  return data as TenantConfig | null;
}
