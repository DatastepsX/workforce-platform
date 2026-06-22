'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTransitions } from '@/lib/workflow';
import type { DemandStatus, UserRole, TenantConfig } from '@/types/database';
import { createNotifications } from './notifications';

async function getConfigForTenant(admin: ReturnType<typeof createAdminClient>, tenantId: string | null): Promise<TenantConfig> {
  if (tenantId) {
    const { data } = await admin.from('tenant_configs').select('*').eq('tenant_id', tenantId).single();
    if (data) return data as TenantConfig;
  }
  // Fallback: first available config
  const { data } = await admin.from('tenant_configs').select('*').limit(1).single();
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
    .select('status, approval_level, created_by, tenant_id')
    .eq('id', demandId)
    .single();
  if (!demand) return { error: 'Demand not found' };

  const config = await getConfigForTenant(admin, (demand as { tenant_id: string | null }).tenant_id);
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

  const { data: actorProfile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single();
  await admin.from('process_history').insert({
    demand_id: demandId,
    from_status: currentStatus,
    to_status: transition.toStatus,
    action,
    actor_id: user.id,
    actor_role: role,
    actor_name: (actorProfile as { full_name: string | null; email: string | null } | null)?.full_name
      || (actorProfile as { full_name: string | null; email: string | null } | null)?.email
      || null,
    notes: notes?.trim() || null,
  });

  // Notify approvers when demand reaches pending_approval
  if (transition.toStatus === 'pending_approval') {
    const [{ data: pendingDemand }, { data: approvers }] = await Promise.all([
      admin.from('demands').select('title').eq('id', demandId).single(),
      admin.from('profiles').select('id').in('role', ['admin', 'hiring_manager']),
    ]);
    if (approvers?.length && pendingDemand) {
      await createNotifications({
        userIds: approvers.map((p: { id: string }) => p.id),
        type: 'demand_pending_approval',
        title: 'Demand awaiting approval',
        body: (pendingDemand as { title: string }).title ?? 'A demand requires your approval',
        relatedId: demandId,
        relatedType: 'demand',
      });
    }
  }

  revalidatePath(`/dashboard/demands/${demandId}`);
  revalidatePath('/dashboard/demands');

  return {};
}

export async function getDemandHistory(demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data: entries } = await admin
    .from('process_history')
    .select('*')
    .eq('demand_id', demandId)
    .order('created_at', { ascending: false });

  if (!entries?.length) return [];

  // Enrich with actor names from profiles
  const actorIds = Array.from(new Set(entries.map((e: { actor_id: string | null }) => e.actor_id).filter(Boolean))) as string[];
  const nameMap: Record<string, string> = {};
  if (actorIds.length) {
    const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('id', actorIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      nameMap[p.id] = p.full_name || p.email || p.id;
    }
  }

  return entries.map((e: { actor_id: string | null }) => ({
    ...e,
    actor_name: e.actor_id ? (nameMap[e.actor_id] ?? null) : null,
  }));
}

export async function getTenantConfig(tenantId?: string | null): Promise<TenantConfig | null> {
  const supabase = await createClient();
  if (tenantId) {
    const { data } = await supabase.from('tenant_configs').select('*').eq('tenant_id', tenantId).single();
    if (data) return data as TenantConfig;
  }
  const { data } = await supabase.from('tenant_configs').select('*').limit(1).single();
  return data as TenantConfig | null;
}
