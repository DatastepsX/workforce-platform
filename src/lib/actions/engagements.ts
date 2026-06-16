'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { emailEngagementCreated } from '@/lib/email';
import type { EngagementStatus } from '@/types/database';

export interface CreateEngagementInput {
  submissionId: string;
  demandId: string;
  demandTitle: string;
  candidateName: string;
  candidateEmail: string | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierEmail: string | null;
  startDate: string;
  endDate: string;
  rate: string;
  rateType: string;
  currency: string;
  notes: string;
}

export async function createEngagement(input: CreateEngagementInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter', 'hiring_manager'].includes(profile?.role ?? '')) {
    return { error: 'Not authorized' };
  }

  const { error: engErr } = await supabase.from('engagements').insert({
    demand_id:      input.demandId,
    submission_id:  input.submissionId,
    supplier_id:    input.supplierId,
    demand_title:   input.demandTitle,
    candidate_name: input.candidateName,
    candidate_email: input.candidateEmail,
    supplier_name:  input.supplierName,
    start_date:     input.startDate || null,
    end_date:       input.endDate || null,
    rate:           input.rate ? Number(input.rate) : null,
    rate_type:      input.rateType || 'daily',
    currency:       input.currency || 'EUR',
    notes:          input.notes || null,
    created_by:     user.id,
    status:         'active',
  });
  if (engErr) return { error: engErr.message };

  // Move submission to 'hired' and close demand
  await Promise.all([
    supabase
      .from('candidate_submissions')
      .update({ status: 'hired' })
      .eq('id', input.submissionId),
    supabase
      .from('demands')
      .update({ status: 'closed' })
      .eq('id', input.demandId),
  ]);

  // Notify supplier
  if (input.supplierId && input.supplierEmail && input.supplierName) {
    try {
      await emailEngagementCreated({
        supplierEmail: input.supplierEmail,
        supplierName:  input.supplierName,
        candidateName: input.candidateName,
        demandTitle:   input.demandTitle,
        startDate:     input.startDate || null,
        endDate:       input.endDate || null,
        rate:          input.rate ? Number(input.rate) : null,
        currency:      input.currency || 'EUR',
      });
    } catch { /* non-blocking */ }
  }

  revalidatePath(`/dashboard/demands/${input.demandId}`);
  revalidatePath('/dashboard/engagements');
  revalidatePath('/supplier');
  return {};
}

export async function updateEngagementStatus(
  id: string,
  status: EngagementStatus,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('engagements').update({ status }).eq('id', id);

  revalidatePath('/dashboard/engagements');
  revalidatePath(`/dashboard/engagements/${id}`);
}
