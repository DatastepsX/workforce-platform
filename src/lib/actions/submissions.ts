'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { emailCandidatesSubmitted, emailSubmissionStatusChanged } from '@/lib/email';
import type { SubmissionStatus } from '@/types/database';

// ── Supplier candidate pool ───────────────────────────────────────────────────

async function getSupplierIdForUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('suppliers').select('id').eq('profile_id', user.id).single();
  return data?.id ?? null;
}

export async function createSupplierCandidate(formData: FormData) {
  const supabase = await createClient();
  const supplierId = await getSupplierIdForUser(supabase);
  if (!supplierId) redirect('/supplier');

  const skills = (formData.get('skills') as string ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const { error } = await supabase.from('supplier_candidates').insert({
    supplier_id: supplierId,
    name:     formData.get('name') as string,
    email:    (formData.get('email') as string) || null,
    phone:    (formData.get('phone') as string) || null,
    headline: (formData.get('headline') as string) || null,
    skills,
    cv_path:  (formData.get('cv_path') as string) || null,
    notes:    (formData.get('notes') as string) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/supplier/candidates');

  const returnTo = formData.get('return_to') as string | null;
  redirect(returnTo || '/supplier/candidates');
}

export async function updateSupplierCandidate(formData: FormData) {
  const supabase = await createClient();
  const supplierId = await getSupplierIdForUser(supabase);
  if (!supplierId) redirect('/supplier');

  const id = formData.get('id') as string;
  const skills = (formData.get('skills') as string ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const { error } = await supabase.from('supplier_candidates').update({
    name:     formData.get('name') as string,
    email:    (formData.get('email') as string) || null,
    phone:    (formData.get('phone') as string) || null,
    headline: (formData.get('headline') as string) || null,
    skills,
    cv_path:  (formData.get('cv_path') as string) || null,
    notes:    (formData.get('notes') as string) || null,
  }).eq('id', id).eq('supplier_id', supplierId);

  if (error) throw new Error(error.message);
  revalidatePath('/supplier/candidates');
  redirect('/supplier/candidates');
}

export async function deleteSupplierCandidate(formData: FormData) {
  const supabase = await createClient();
  const supplierId = await getSupplierIdForUser(supabase);
  if (!supplierId) redirect('/supplier');

  const id = formData.get('id') as string;
  await supabase.from('supplier_candidates').delete()
    .eq('id', id).eq('supplier_id', supplierId);

  revalidatePath('/supplier/candidates');
  redirect('/supplier/candidates');
}

// ── Submit candidates to a demand ─────────────────────────────────────────────

export interface CandidateSubmissionInput {
  id: string;
  proposed_rate: number | null;
  rate_type: string;
}

export async function submitCandidates(
  demandId: string,
  submissions: CandidateSubmissionInput[],
  notes: string,
) {
  if (!submissions.length) return { error: 'No candidates selected' };

  const supabase = await createClient();
  const supplierId = await getSupplierIdForUser(supabase);
  if (!supplierId) return { error: 'No supplier account found' };

  const ids = submissions.map(s => s.id);

  const { data: candidates } = await supabase
    .from('supplier_candidates')
    .select('id, name, email, cv_path')
    .in('id', ids)
    .eq('supplier_id', supplierId);

  if (!candidates?.length) return { error: 'Candidates not found' };

  // Filter out already-submitted candidates
  const { data: existing } = await supabase
    .from('candidate_submissions')
    .select('supplier_candidate_id')
    .eq('demand_id', demandId)
    .eq('supplier_id', supplierId)
    .in('supplier_candidate_id', ids);

  const alreadySubmitted = new Set((existing ?? []).map(e => e.supplier_candidate_id));
  const newCandidates = candidates.filter(c => !alreadySubmitted.has(c.id));

  if (newCandidates.length === 0) return { success: true };

  const rateMap = Object.fromEntries(submissions.map(s => [s.id, s]));

  const { error } = await supabase.from('candidate_submissions').insert(
    newCandidates.map(c => ({
      demand_id:             demandId,
      supplier_id:           supplierId,
      supplier_candidate_id: c.id,
      candidate_name:        c.name,
      candidate_email:       c.email ?? null,
      cv_path:               c.cv_path ?? null,
      notes:                 notes || null,
      proposed_rate:         rateMap[c.id]?.proposed_rate ?? null,
      rate_type:             rateMap[c.id]?.rate_type ?? 'daily',
    })),
  );

  if (error) return { error: error.message };

  // Update demand_supplier status to submitted
  await supabase.from('demand_suppliers')
    .update({ status: 'submitted' })
    .eq('demand_id', demandId)
    .eq('supplier_id', supplierId);

  // Email notification: inform recruiters/admins
  try {
    const { data: demand } = await supabase.from('demands').select('title').eq('id', demandId).single();
    const { data: supplier } = await supabase.from('suppliers').select('company_name').eq('id', supplierId).single();
    const { data: recruiters } = await supabase.from('profiles')
      .select('email').in('role', ['recruiter', 'admin']).not('email', 'is', null);

    if (demand && supplier && recruiters?.length) {
      await emailCandidatesSubmitted({
        recruiterEmails: recruiters.map(r => r.email!),
        supplierName: supplier.company_name,
        demandTitle: demand.title,
        demandId,
        candidateNames: newCandidates.map(c => c.name),
      });
    }
  } catch { /* non-blocking */ }

  revalidatePath(`/supplier/demands/${demandId}/submit`);
  revalidatePath('/supplier');
  return { success: true };
}

// ── Recruiter: update submission status ───────────────────────────────────────

export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  demandId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('candidate_submissions').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/demands/${demandId}/submissions`);

  // Email notification for key status changes
  try {
    const { data: sub } = await supabase
      .from('candidate_submissions')
      .select('candidate_name, supplier_id')
      .eq('id', id).single();
    const { data: demand } = await supabase
      .from('demands').select('title, created_by').eq('id', demandId).single();

    if (!sub || !demand) return;

    if (['rejected', 'offer', 'hired'].includes(status)) {
      // Notify supplier
      const { data: supplier } = await supabase
        .from('suppliers').select('email, contact_name, company_name').eq('id', sub.supplier_id).single();
      if (supplier?.email) {
        await emailSubmissionStatusChanged({
          toEmail: supplier.email,
          toName: supplier.contact_name ?? supplier.company_name,
          candidateName: sub.candidate_name,
          demandTitle: demand.title,
          demandId,
          status,
          isSupplier: true,
        });
      }
    }

    if (['shortlisted', 'interview'].includes(status)) {
      // Notify hiring manager
      const { data: hm } = await supabase
        .from('profiles').select('email, full_name').eq('id', demand.created_by).single();
      if (hm?.email) {
        await emailSubmissionStatusChanged({
          toEmail: hm.email,
          toName: hm.full_name ?? hm.email,
          candidateName: sub.candidate_name,
          demandTitle: demand.title,
          demandId,
          status,
          isSupplier: false,
        });
      }
    }
  } catch { /* non-blocking */ }
}
