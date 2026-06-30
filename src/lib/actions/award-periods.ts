'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { AwardPeriod, BillingPeriodType, PeriodCostEntry } from '@/types/database';

const adminDb = createAdminClient();

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  return { userId: user.id, role: profile?.role ?? '' };
}

// ── Period generation ────────────────────────────────────────────────────────

export async function generatePeriodDates(
  periodType: BillingPeriodType,
  startDate: string,
  endDate: string,
): Promise<{ label: string; start: Date; end: Date }[]> {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const periods: { label: string; start: Date; end: Date }[] = [];

  if (periodType === 'weekly') {
    // eslint-disable-next-line prefer-const
    let curMs = start.getTime();
    let n = 1;
    while (curMs <= end.getTime()) {
      const pStart = new Date(curMs);
      const pEnd   = new Date(Math.min(curMs + 6 * 86400000, end.getTime()));
      periods.push({ label: `Week ${n}`, start: pStart, end: pEnd });
      curMs += 7 * 86400000;
      n++;
    }
  } else if (periodType === 'bi_weekly') {
    // eslint-disable-next-line prefer-const
    let curMs = start.getTime();
    let n = 1;
    while (curMs <= end.getTime()) {
      const pStart = new Date(curMs);
      const pEnd   = new Date(Math.min(curMs + 13 * 86400000, end.getTime()));
      periods.push({ label: `Period ${n}`, start: pStart, end: pEnd });
      curMs += 14 * 86400000;
      n++;
    }
  } else if (periodType === 'monthly') {
    let yr = start.getFullYear();
    let mo = start.getMonth();
    while (new Date(yr, mo, 1) <= end) {
      const pStart = new Date(yr, mo, 1);
      const pEnd   = new Date(Math.min(new Date(yr, mo + 1, 0).getTime(), end.getTime()));
      const label  = pStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      periods.push({ label, start: pStart, end: pEnd });
      if (mo === 11) { yr++; mo = 0; } else { mo++; }
    }
  } else {
    // milestone or fixed — single period covering the whole award
    periods.push({ label: periodType === 'milestone' ? 'Milestone 1' : 'Fixed Fee', start, end });
  }

  return periods;
}

export async function generateAwardPeriods(awardId: string): Promise<void> {
  const { role } = await getUser();
  if (!['admin', 'super_admin', 'recruiter'].includes(role)) throw new Error('Forbidden');

  const { data: award } = await adminDb
    .from('awards')
    .select('billing_period_type, start_date, end_date')
    .eq('id', awardId)
    .single();

  if (!award?.billing_period_type || !award.start_date || !award.end_date) {
    throw new Error('Award must have billing_period_type, start_date and end_date set');
  }

  // Delete existing periods (re-generate)
  await adminDb.from('award_periods').delete().eq('award_id', awardId);

  const periods = await generatePeriodDates(award.billing_period_type, award.start_date, award.end_date);

  await adminDb.from('award_periods').insert(
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

  revalidatePath(`/dashboard/awards/${awardId}`);
}

export async function updateAwardBillingPeriodType(awardId: string, periodType: BillingPeriodType): Promise<void> {
  const { role } = await getUser();
  if (!['admin', 'super_admin', 'recruiter'].includes(role)) throw new Error('Forbidden');
  await adminDb.from('awards').update({ billing_period_type: periodType }).eq('id', awardId);
  revalidatePath(`/dashboard/awards/${awardId}`);
}

// ── Period queries ───────────────────────────────────────────────────────────

export async function listAwardPeriods(awardId: string): Promise<AwardPeriod[]> {
  const { data, error } = await adminDb
    .from('award_periods')
    .select('*')
    .eq('award_id', awardId)
    .order('period_number');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAwardPeriod(periodId: string): Promise<(AwardPeriod & { entries: PeriodCostEntry[] }) | null> {
  const { data: period } = await adminDb
    .from('award_periods')
    .select('*')
    .eq('id', periodId)
    .single();
  if (!period) return null;

  const { data: entries } = await adminDb
    .from('period_cost_entries')
    .select('*, cost_item:cost_items(id, code, name, category_id)')
    .eq('period_id', periodId)
    .order('created_at');

  return { ...period, entries: entries ?? [] };
}

export async function listAllPeriods(filters?: {
  awardId?: string;
  tenantId?: string;
  status?: string;
}): Promise<(AwardPeriod & { award?: { candidate_name: string; demand_title: string; tenant_id: string | null }; computed_total: number | null })[]> {
  let q = adminDb
    .from('award_periods')
    .select('*, award:awards(candidate_name, demand_title, tenant_id, supplier_id), cost_entries:period_cost_entries(amount,status)')
    .order('start_date', { nullsFirst: false });

  if (filters?.awardId) q = q.eq('award_id', filters.awardId);
  if (filters?.status)  q = q.eq('status', filters.status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as (AwardPeriod & { award?: { candidate_name: string; demand_title: string; tenant_id: string | null }; cost_entries?: { amount: number; status: string }[] })[];

  if (filters?.tenantId) {
    rows = rows.filter(r => r.award?.tenant_id === filters.tenantId);
  }

  return rows.map(r => {
    const entries = r.cost_entries ?? [];
    const total = entries.filter(e => e.status !== 'rejected').reduce((s, e) => s + (e.amount ?? 0), 0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cost_entries: _, ...rest } = r as typeof r & { cost_entries?: unknown };
    return { ...rest, computed_total: total > 0 ? total : null };
  });
}

export async function updatePeriodStatus(periodId: string, status: string): Promise<void> {
  const { role } = await getUser();
  if (!['admin', 'super_admin', 'recruiter', 'procurement', 'finance'].includes(role)) throw new Error('Forbidden');
  const { data: period } = await adminDb.from('award_periods').select('award_id').eq('id', periodId).single();
  await adminDb.from('award_periods').update({ status }).eq('id', periodId);
  if (period) revalidatePath(`/dashboard/awards/${period.award_id}`);
  revalidatePath('/dashboard/cost-items');
}

// ── Cost entries ─────────────────────────────────────────────────────────────

export async function createCostEntry(formData: FormData): Promise<void> {
  const { userId } = await getUser();
  const periodId = formData.get('period_id') as string;

  const { data: period } = await adminDb.from('award_periods').select('award_id, status').eq('id', periodId).single();
  if (!period) throw new Error('Period not found');
  if (period.status !== 'open') throw new Error('Period is not open for entries');

  await adminDb.from('period_cost_entries').insert({
    period_id:    periodId,
    award_id:     period.award_id,
    cost_item_id: formData.get('cost_item_id') as string || null,
    submitted_by: userId,
    entry_type:   formData.get('entry_type') as string || 'timesheet',
    quantity:     Number(formData.get('quantity') ?? 0),
    unit_price:   Number(formData.get('unit_price') ?? 0),
    currency:     formData.get('currency') as string || 'EUR',
    description:  formData.get('description') as string || null,
    notes:        formData.get('notes') as string || null,
    status:       'draft',
  });

  revalidatePath(`/dashboard/cost-items/${periodId}`);
  revalidatePath(`/dashboard/awards/${period.award_id}`);
}

export async function submitPeriod(periodId: string): Promise<void> {
  const { userId } = await getUser();

  // Mark all draft entries for this submitter as submitted
  await adminDb
    .from('period_cost_entries')
    .update({ status: 'submitted' })
    .eq('period_id', periodId)
    .eq('submitted_by', userId)
    .eq('status', 'draft');

  // If all entries submitted → mark period submitted
  const { data: remaining } = await adminDb
    .from('period_cost_entries')
    .select('id')
    .eq('period_id', periodId)
    .eq('status', 'draft');

  if (!remaining?.length) {
    await adminDb.from('award_periods').update({ status: 'submitted' }).eq('id', periodId);
  }

  const { data: period } = await adminDb.from('award_periods').select('award_id').eq('id', periodId).single();
  if (period) revalidatePath(`/dashboard/awards/${period.award_id}`);
  revalidatePath(`/dashboard/cost-items/${periodId}`);
  revalidatePath('/dashboard/cost-items');
}

export async function reviewCostEntry(entryId: string, approve: boolean, rejectionReason?: string): Promise<void> {
  const { userId, role } = await getUser();
  if (!['admin', 'super_admin', 'recruiter', 'procurement', 'finance'].includes(role)) throw new Error('Forbidden');

  await adminDb.from('period_cost_entries').update({
    status:           approve ? 'approved' : 'rejected',
    reviewed_by:      userId,
    reviewed_at:      new Date().toISOString(),
    rejection_reason: rejectionReason ?? null,
  }).eq('id', entryId);

  const { data: entry } = await adminDb.from('period_cost_entries').select('period_id, award_id').eq('id', entryId).single();
  if (entry) {
    revalidatePath(`/dashboard/cost-items/${entry.period_id}`);
    revalidatePath(`/dashboard/awards/${entry.award_id}`);
  }
  revalidatePath('/dashboard/cost-items');
}

export async function deleteCostEntry(entryId: string): Promise<void> {
  const { userId } = await getUser();
  const { data: entry } = await adminDb.from('period_cost_entries').select('submitted_by, status, period_id, award_id').eq('id', entryId).single();
  if (!entry) return;
  if (entry.submitted_by !== userId && !['admin','super_admin'].includes((await getUser()).role)) throw new Error('Forbidden');
  if (entry.status !== 'draft') throw new Error('Can only delete draft entries');
  await adminDb.from('period_cost_entries').delete().eq('id', entryId);
  revalidatePath(`/dashboard/cost-items/${entry.period_id}`);
  revalidatePath(`/dashboard/awards/${entry.award_id}`);
}

export async function updateCostEntry(entryId: string, formData: FormData): Promise<void> {
  const { userId, role } = await getUser();
  const { data: entry } = await adminDb.from('period_cost_entries').select('submitted_by, status, period_id, award_id').eq('id', entryId).single();
  if (!entry) throw new Error('Entry not found');
  if (entry.status !== 'draft') throw new Error('Can only edit draft entries');
  if (entry.submitted_by !== userId && !['admin','super_admin'].includes(role)) throw new Error('Forbidden');

  await adminDb.from('period_cost_entries').update({
    entry_type:   formData.get('entry_type') as string || 'timesheet',
    quantity:     Number(formData.get('quantity') ?? 0),
    unit_price:   Number(formData.get('unit_price') ?? 0),
    description:  formData.get('description') as string || null,
    notes:        formData.get('notes') as string || null,
  }).eq('id', entryId);

  revalidatePath(`/dashboard/cost-items/${entry.period_id}`);
  revalidatePath(`/dashboard/awards/${entry.award_id}`);
}

export async function createDailyTimesheetEntries(
  periodId: string,
  days: { date: string; quantity: number; description?: string }[],
  unitPrice: number,
  currency: string,
): Promise<void> {
  const { userId } = await getUser();
  const { data: period } = await adminDb.from('award_periods').select('award_id, status').eq('id', periodId).single();
  if (!period) throw new Error('Period not found');
  if (period.status !== 'open') throw new Error('Period is not open');

  const validDays = days.filter(d => d.quantity > 0);
  if (!validDays.length) return;

  await adminDb.from('period_cost_entries').insert(
    validDays.map(d => ({
      period_id:    periodId,
      award_id:     period.award_id,
      submitted_by: userId,
      entry_type:   'timesheet',
      quantity:     d.quantity,
      unit_price:   unitPrice,
      currency:     currency || 'EUR',
      description:  d.description || d.date,
      notes:        null,
      status:       'draft',
    }))
  );

  revalidatePath(`/dashboard/cost-items/${periodId}`);
  revalidatePath(`/dashboard/awards/${period.award_id}`);
}
