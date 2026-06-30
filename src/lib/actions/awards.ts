'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotifications } from '@/lib/actions/notifications';
import { generatePeriodDates } from '@/lib/actions/award-periods';
import type { Award, AwardStatus, TenantConfig } from '@/types/database';

export interface CreateAwardInput {
  demandId: string;
  submissionId: string;
  demandTitle: string;
  candidateName: string;
  candidateEmail: string | null;
  supplierId: string | null;
  supplierName: string | null;
  startDate: string;
  endDate: string;
  rate: string;
  rateType: string;
  currency: string;
  notes: string;
  totalAmount: number | null;
  priceLocked: boolean;
}

export async function createAward(input: CreateAwardInput): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const admin = createAdminClient();

  const [{ data: profile }, { data: demand }, { data: submission }] = await Promise.all([
    admin.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
    admin.from('demands').select('status, approval_level, tenant_id, title, billing_period_type').eq('id', input.demandId).single(),
    admin.from('candidate_submissions').select('candidate_name, demand_id').eq('id', input.submissionId).single(),
  ]);

  if (!profile || !demand || !submission) return { error: 'Record not found' };
  if ((submission as { demand_id: string }).demand_id !== input.demandId) return { error: 'Submission does not belong to this demand' };
  if ((demand as { status: string }).status !== 'screening') return { error: 'Can only award from screening stage' };

  const { data: tenantConfig } = (demand as { tenant_id: string | null }).tenant_id
    ? await admin.from('tenant_configs').select('*').eq('tenant_id', (demand as { tenant_id: string }).tenant_id).single()
    : await admin.from('tenant_configs').select('*').limit(1).single();
  const config = tenantConfig as TenantConfig | null;
  const awardMspOffer = config?.award_msp_offer ?? true;

  const role = (profile as { role: string }).role;
  const canAward =
    ['admin', 'super_admin'].includes(role) ||
    (role === 'recruiter' && awardMspOffer) ||
    (role === 'hiring_manager' && !awardMspOffer);
  if (!canAward) return { error: 'Not authorized to award candidates per current configuration' };

  const { data: award, error: awardErr } = await admin.from('awards').insert({
    demand_id: input.demandId,
    submission_id: input.submissionId,
    supplier_id: input.supplierId,
    tenant_id: (demand as { tenant_id: string | null }).tenant_id,
    candidate_name: input.candidateName,
    candidate_email: input.candidateEmail,
    supplier_name: input.supplierName,
    demand_title: input.demandTitle,
    rate: input.rate ? Number(input.rate) : null,
    rate_type: input.rateType || 'daily',
    currency: input.currency || 'EUR',
    total_amount: input.totalAmount ?? null,
    price_locked: input.priceLocked ?? false,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    billing_period_type: (demand as { billing_period_type?: string | null }).billing_period_type ?? null,
    status: 'pending_approval',
    notes: input.notes || null,
    created_by: user.id,
  }).select('id').single();

  if (awardErr) return { error: awardErr.message };

  const awardId = (award as { id: string }).id;
  const tenantId = (demand as { tenant_id: string | null }).tenant_id;

  // Transition demand to 'award' status
  const awardApprovalLevels = config?.award_approval_levels ?? 0;
  const nextApprovalLevel = awardApprovalLevels > 0 ? 1 : null;
  await admin.from('demands').update({
    status: 'award',
    approval_level: nextApprovalLevel,
    updated_at: new Date().toISOString(),
  }).eq('id', input.demandId);

  // Mark submission as 'offer' (awaiting award approval)
  await admin.from('candidate_submissions').update({ status: 'offer' }).eq('id', input.submissionId);

  // Log to process history
  const actorName = (profile as { full_name: string | null; email: string | null }).full_name
    || (profile as { full_name: string | null; email: string | null }).email || null;
  await admin.from('process_history').insert({
    demand_id: input.demandId,
    from_status: 'screening',
    to_status: 'award',
    action: 'AWARD_SUBMISSION',
    actor_id: user.id,
    actor_role: role,
    actor_name: actorName,
    notes: `${input.candidateName}: Award created`,
  });

  // Notify award approvers — relatedId is the award ID so bell routes to /awards/[id]
  if (config && awardApprovalLevels > 0) {
    const awardApproverKey = `award_approval_role_l1` as keyof typeof config;
    const awardApproverRole = (config[awardApproverKey] as string | null);
    const rolesToNotify = ['admin'];
    if (awardApproverRole && !rolesToNotify.includes(awardApproverRole)) rolesToNotify.push(awardApproverRole);
    const { data: approvers } = tenantId
      ? await admin.from('profiles').select('id').in('role', rolesToNotify).eq('tenant_id', tenantId)
      : await admin.from('profiles').select('id').in('role', rolesToNotify);
    if (approvers?.length) {
      await createNotifications({
        userIds: approvers.map((p: { id: string }) => p.id),
        type: 'award_pending_approval',
        title: 'Award approval required',
        body: `${input.candidateName} — ${input.demandTitle}`,
        relatedId: awardId,
        relatedType: 'award',
      });
    }
  }

  revalidatePath(`/dashboard/demands/${input.demandId}`);
  revalidatePath('/dashboard/awards');

  return { id: awardId };
}

const AWARD_APPROVER_ROLES = ['admin', 'recruiter', 'super_admin', 'procurement', 'finance'];

export async function updateAwardStatus(
  awardId: string,
  status: AwardStatus,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role;
  if (!AWARD_APPROVER_ROLES.includes(role ?? '')) return { error: 'Not authorized' };

  // Fetch current award to get linked demand/submission + billing info
  const { data: awardData } = await admin.from('awards').select('demand_id, submission_id, candidate_name, demand_title, billing_period_type, start_date, end_date').eq('id', awardId).single();
  const award = awardData as { demand_id: string | null; submission_id: string | null; candidate_name: string; demand_title: string; billing_period_type: string | null; start_date: string | null; end_date: string | null } | null;

  const { error } = await admin.from('awards').update({
    status,
    updated_at: new Date().toISOString(),
  }).eq('id', awardId);

  if (error) return { error: error.message };

  // When award is approved → submission becomes 'awarded'
  if (status === 'approved' && award?.submission_id) {
    await admin.from('candidate_submissions').update({ status: 'awarded' }).eq('id', award.submission_id);
  }

  // When award goes active → demand is filled + auto-generate billing periods
  if (status === 'active' && award?.demand_id) {
    await admin.from('demands').update({
      status: 'filled',
      updated_at: new Date().toISOString(),
    }).eq('id', award.demand_id);
    revalidatePath(`/dashboard/demands/${award.demand_id}`);
  }
  if (status === 'active' && award?.billing_period_type && award.start_date && award.end_date) {
    try {
      await admin.from('award_periods').delete().eq('award_id', awardId);
      const periods = await generatePeriodDates(award.billing_period_type as import('@/types/database').BillingPeriodType, award.start_date, award.end_date);
      await admin.from('award_periods').insert(
        periods.map((p, i) => ({
          award_id:      awardId,
          period_number: i + 1,
          period_type:   award.billing_period_type,
          label:         p.label,
          start_date:    p.start.toISOString().split('T')[0],
          end_date:      p.end.toISOString().split('T')[0],
          status:        'open',
        }))
      );
    } catch { /* non-blocking */ }
  }

  revalidatePath('/dashboard/awards');
  revalidatePath(`/dashboard/awards/${awardId}`);
  return {};
}

export async function updateAwardPO(
  awardId: string,
  poNumber: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role;
  if (!AWARD_APPROVER_ROLES.includes(role ?? '')) return { error: 'Not authorized' };

  const { error } = await admin.from('awards').update({
    po_number: poNumber || null,
    updated_at: new Date().toISOString(),
  }).eq('id', awardId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/awards');
  revalidatePath(`/dashboard/awards/${awardId}`);
  return {};
}

export async function getAwardsByDemand(demandId: string): Promise<Award[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('awards')
    .select('*')
    .eq('demand_id', demandId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Award[];
}
