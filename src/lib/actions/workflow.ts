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

  // Auto-assign suppliers from JD supplier categories when demand reaches sourcing
  if (transition.toStatus === 'sourcing') {
    try {
      const demandWithJd = await admin
        .from('demands')
        .select('job_description_id, tenant_id')
        .eq('id', demandId)
        .single();
      const jdId = (demandWithJd.data as { job_description_id: string | null; tenant_id: string | null } | null)?.job_description_id;
      const tenantId = (demandWithJd.data as { job_description_id: string | null; tenant_id: string | null } | null)?.tenant_id;
      if (jdId && tenantId) {
        // Get supplier categories linked to this JD that are also active for this tenant
        const [{ data: jdCats }, { data: tenantCats }] = await Promise.all([
          admin.from('jd_supplier_categories').select('supplier_category_id').eq('job_description_id', jdId),
          admin.from('tenant_supplier_categories').select('supplier_category_id').eq('tenant_id', tenantId),
        ]);
        const jdCatIds = new Set((jdCats ?? []).map((r: { supplier_category_id: string }) => r.supplier_category_id));
        const tenantCatIds = new Set((tenantCats ?? []).map((r: { supplier_category_id: string }) => r.supplier_category_id));
        const activeCatIds = Array.from(jdCatIds).filter(id => tenantCatIds.has(id));

        if (activeCatIds.length > 0) {
          // Find suppliers in these categories that are assigned + active for this tenant
          const [{ data: members }, { data: tenantSuppliers }] = await Promise.all([
            admin.from('supplier_category_members').select('supplier_id').in('supplier_category_id', activeCatIds),
            admin.from('tenant_suppliers').select('supplier_id').eq('tenant_id', tenantId).eq('active', true),
          ]);
          const memberSupplierIds = new Set((members ?? []).map((r: { supplier_id: string }) => r.supplier_id));
          const tenantSupplierIds = new Set((tenantSuppliers ?? []).map((r: { supplier_id: string }) => r.supplier_id));
          const autoSupplierIds = Array.from(memberSupplierIds).filter(id => tenantSupplierIds.has(id));

          if (autoSupplierIds.length > 0) {
            // Get already-assigned suppliers so we don't duplicate
            const { data: existing } = await admin
              .from('demand_suppliers')
              .select('supplier_id')
              .eq('demand_id', demandId);
            const existingIds = new Set((existing ?? []).map((r: { supplier_id: string }) => r.supplier_id));
            const toInsert = autoSupplierIds.filter(id => !existingIds.has(id));
            if (toInsert.length > 0) {
              await admin.from('demand_suppliers').insert(
                toInsert.map(sid => ({ demand_id: demandId, supplier_id: sid, sent_at: new Date().toISOString() }))
              );
            }
          }
        }
      }
    } catch { /* non-blocking — auto-assign is best-effort */ }
  }

  // Notify demand creator (HM) when demand is returned for revision
  if (action === 'RETURN') {
    const creatorId = (demand as { created_by: string }).created_by;
    if (creatorId && creatorId !== user.id) {
      const { data: returnedDemand } = await admin.from('demands').select('title').eq('id', demandId).single();
      await createNotifications({
        userIds: [creatorId],
        type: 'demand_returned',
        title: 'Demand returned for revision',
        body: (returnedDemand as { title: string } | null)?.title ?? 'Your demand requires changes',
        relatedId: demandId,
        relatedType: 'demand',
      });
    }
  }

  // Notify demand creator when demand reaches sourcing (approved and live)
  if (transition.toStatus === 'sourcing') {
    const creatorId = (demand as { created_by: string }).created_by;
    if (creatorId) {
      const { data: approvedDemand } = await admin.from('demands').select('title').eq('id', demandId).single();
      await createNotifications({
        userIds: [creatorId],
        type: 'demand_approved',
        title: 'Demand approved and live',
        body: (approvedDemand as { title: string } | null)?.title ?? 'Your demand is now live for sourcing',
        relatedId: demandId,
        relatedType: 'demand',
      });
    }
  }

  // Notify recruiters/admins when demand reaches pending_review (MSP review queue)
  if (transition.toStatus === 'pending_review') {
    const demandTenantId = (demand as { tenant_id: string | null }).tenant_id;
    const [{ data: reviewDemand }, { data: reviewers }] = await Promise.all([
      admin.from('demands').select('title').eq('id', demandId).single(),
      demandTenantId
        ? admin.from('profiles').select('id').in('role', ['recruiter', 'admin']).eq('tenant_id', demandTenantId)
        : admin.from('profiles').select('id').in('role', ['recruiter', 'admin']),
    ]);
    if (reviewers?.length && reviewDemand) {
      await createNotifications({
        userIds: reviewers.map((p: { id: string }) => p.id),
        type: 'demand_pending_review',
        title: 'Review required',
        body: (reviewDemand as { title: string }).title ?? 'A demand requires your review',
        relatedId: demandId,
        relatedType: 'demand',
      });
    }
  }

  // Notify the configured approver role when demand reaches pending_approval
  if (transition.toStatus === 'pending_approval') {
    const nextLevel = transition.toApprovalLevel ?? 1;
    const approverRoleKey = `demand_approval_role_l${nextLevel}` as keyof TenantConfig;
    const approverRole = config[approverRoleKey] as string | null;
    const rolesToNotify = ['admin'];
    if (approverRole && !rolesToNotify.includes(approverRole)) rolesToNotify.push(approverRole);

    const demandTenantId = (demand as { tenant_id: string | null }).tenant_id;
    const [{ data: pendingDemand }, { data: approvers }] = await Promise.all([
      admin.from('demands').select('title').eq('id', demandId).single(),
      demandTenantId
        ? admin.from('profiles').select('id').in('role', rolesToNotify).eq('tenant_id', demandTenantId)
        : admin.from('profiles').select('id').in('role', rolesToNotify),
    ]);
    if (approvers?.length && pendingDemand) {
      const levelInfo = config.demand_approval_levels > 1 ? ` (Level ${nextLevel} of ${config.demand_approval_levels})` : '';
      await createNotifications({
        userIds: approvers.map((p: { id: string }) => p.id),
        type: 'demand_pending_approval',
        title: `Approval required${levelInfo}`,
        body: (pendingDemand as { title: string }).title ?? 'A demand requires your approval',
        relatedId: demandId,
        relatedType: 'demand',
      });
    }
  }

  // Notify award approvers when demand reaches award status
  if (transition.toStatus === 'award') {
    const nextLevel = transition.toApprovalLevel ?? 1;
    const awardApproverKey = `award_approval_role_l${nextLevel}` as keyof TenantConfig;
    const awardApproverRole = config[awardApproverKey] as string | null;
    const awardRolesToNotify = ['admin'];
    if (awardApproverRole && !awardRolesToNotify.includes(awardApproverRole)) {
      awardRolesToNotify.push(awardApproverRole);
    }
    const demandTenantId = (demand as { tenant_id: string | null }).tenant_id;
    const [{ data: awardDemand }, { data: awardApprovers }] = await Promise.all([
      admin.from('demands').select('title').eq('id', demandId).single(),
      demandTenantId
        ? admin.from('profiles').select('id').in('role', awardRolesToNotify).eq('tenant_id', demandTenantId)
        : admin.from('profiles').select('id').in('role', awardRolesToNotify),
    ]);
    if (awardApprovers?.length && awardDemand) {
      const levelInfo = config.award_approval_levels > 1 ? ` (Level ${nextLevel} of ${config.award_approval_levels})` : '';
      await createNotifications({
        userIds: awardApprovers.map((p: { id: string }) => p.id),
        type: 'award_pending_approval',
        title: `Award approval required${levelInfo}`,
        body: (awardDemand as { title: string }).title ?? 'A candidate award requires your approval',
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
