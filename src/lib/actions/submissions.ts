'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailCandidatesSubmitted, emailSubmissionStatusChanged } from '@/lib/email';
import { createNotifications } from '@/lib/actions/notifications';
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

  // CV upload
  let cvPath: string | null = (formData.get('cv_path') as string) || null;
  const cvFile = formData.get('cv_file') as File | null;
  if (cvFile && cvFile.size > 0) {
    try {
      const admin = createAdminClient();
      const fileName = `${Date.now()}-${cvFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadErr } = await admin.storage.from('supplier-cvs').upload(fileName, cvFile, { contentType: cvFile.type });
      if (!uploadErr) cvPath = `supplier-cvs/${fileName}`;
    } catch { /* non-blocking */ }
  }

  const { error } = await supabase.from('supplier_candidates').insert({
    supplier_id:      supplierId,
    name:             formData.get('name') as string,
    email:            (formData.get('email') as string) || null,
    phone:            (formData.get('phone') as string) || null,
    headline:         (formData.get('headline') as string) || null,
    skills,
    cv_path:          cvPath,
    notes:            (formData.get('notes') as string) || null,
    hourly_rate_min:  formData.get('hourly_rate_min') ? Number(formData.get('hourly_rate_min')) : null,
    hourly_rate_max:  formData.get('hourly_rate_max') ? Number(formData.get('hourly_rate_max')) : null,
    currency:         (formData.get('currency') as string) || 'EUR',
    availability:     (formData.get('availability') as string) || null,
    location:         (formData.get('location') as string) || null,
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

  // CV upload
  let cvPath: string | null = (formData.get('cv_path') as string) || null;
  const cvFile = formData.get('cv_file') as File | null;
  if (cvFile && cvFile.size > 0) {
    try {
      const admin = createAdminClient();
      const fileName = `${Date.now()}-${cvFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadErr } = await admin.storage.from('supplier-cvs').upload(fileName, cvFile, { contentType: cvFile.type });
      if (!uploadErr) cvPath = `supplier-cvs/${fileName}`;
    } catch { /* non-blocking */ }
  }

  const { error } = await supabase.from('supplier_candidates').update({
    name:             formData.get('name') as string,
    email:            (formData.get('email') as string) || null,
    phone:            (formData.get('phone') as string) || null,
    headline:         (formData.get('headline') as string) || null,
    skills,
    cv_path:          cvPath,
    notes:            (formData.get('notes') as string) || null,
    hourly_rate_min:  formData.get('hourly_rate_min') ? Number(formData.get('hourly_rate_min')) : null,
    hourly_rate_max:  formData.get('hourly_rate_max') ? Number(formData.get('hourly_rate_max')) : null,
    currency:         (formData.get('currency') as string) || 'EUR',
    availability:     (formData.get('availability') as string) || null,
    location:         (formData.get('location') as string) || null,
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

  // Log supplier submission to process_history
  try {
    const adminForLog = createAdminClient();
    const { data: supplierForLog } = await adminForLog.from('suppliers').select('company_name').eq('id', supplierId).single();
    await adminForLog.from('process_history').insert({
      demand_id:  demandId,
      to_status:  'sourcing',
      action:     'CANDIDATES_SUBMITTED',
      actor_role: 'supplier',
      notes:      `${supplierForLog?.company_name ?? 'Supplier'} submitted ${newCandidates.length} candidate${newCandidates.length > 1 ? 's' : ''}`,
    });
  } catch { /* non-blocking */ }

  // Email + in-app notifications
  try {
    const notifyAdmin = createAdminClient();
    const { data: demand } = await notifyAdmin.from('demands').select('title, created_by').eq('id', demandId).single();
    const { data: supplier } = await notifyAdmin.from('suppliers').select('company_name').eq('id', supplierId).single();
    const { data: targetProfiles } = await notifyAdmin.from('profiles')
      .select('id, email, role').in('role', ['recruiter', 'admin']).not('email', 'is', null);

    // Also notify the HM who owns this demand
    let allTargetIds = (targetProfiles ?? []).map(r => r.id);
    if (demand?.created_by) {
      const { data: owner } = await notifyAdmin.from('profiles').select('id, role, email').eq('id', demand.created_by).single();
      if (owner?.role === 'hiring_manager' && !allTargetIds.includes(owner.id)) {
        allTargetIds = [...allTargetIds, owner.id];
      }
    }

    if (demand && allTargetIds.length) {
      await createNotifications({
        userIds: allTargetIds,
        type: 'new_submission',
        title: `Neue Bewerbung${newCandidates.length > 1 ? 'en' : ''}: ${newCandidates.map(c => c.name).join(', ')}`,
        body: `Eingereicht für "${demand.title}"`,
        relatedId: demandId,
        relatedType: 'demand',
      });
    }

    if (demand && supplier && targetProfiles?.length) {
      await emailCandidatesSubmitted({
        recruiterEmails: targetProfiles.map(r => r.email!).filter(Boolean),
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

const SUBMISSION_STATUS_ACTIONS: Partial<Record<SubmissionStatus, string>> = {
  shortlisted: 'SUBMISSION_SHORTLISTED',
  interview:   'SUBMISSION_INTERVIEW',
  rejected:    'SUBMISSION_REJECTED',
  hired:       'SUBMISSION_HIRED',
  offer:       'SUBMISSION_OFFER',
};

export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  demandId: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('candidate_submissions').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/demands/${demandId}/submissions`);

  // Log to process_history for demand-level audit trail
  const action = SUBMISSION_STATUS_ACTIONS[status];
  if (action && user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const { data: sub } = await supabase.from('candidate_submissions').select('candidate_name').eq('id', id).single();
    try {
      const admin = createAdminClient();
      await admin.from('process_history').insert({
        demand_id:  demandId,
        to_status:  status,
        action,
        actor_id:   user.id,
        actor_role: profile?.role ?? null,
        notes:      sub?.candidate_name ? `${sub.candidate_name}` : null,
      });
    } catch { /* non-blocking */ }
  }

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

// Assign a supplier candidate to a demand directly from the admin match pool
export async function assignSupplierCandidateToDemand(
  supplierCandidateId: string,
  demandId: string,
): Promise<{ error?: string; alreadyExists?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter', 'hiring_manager'].includes(profile?.role ?? '')) {
    return { error: 'Not authorized' };
  }

  // Check if already submitted
  const { data: existing } = await supabase
    .from('candidate_submissions')
    .select('id')
    .eq('demand_id', demandId)
    .eq('supplier_candidate_id', supplierCandidateId)
    .maybeSingle();
  if (existing) return { alreadyExists: true };

  // Fetch supplier candidate info using admin client (bypasses supplier RLS)
  const admin = createAdminClient();
  const { data: sc } = await admin
    .from('supplier_candidates')
    .select('name, email, cv_path, supplier_id')
    .eq('id', supplierCandidateId)
    .single();
  if (!sc) return { error: 'Candidate not found' };

  const { error } = await supabase.from('candidate_submissions').insert({
    demand_id:             demandId,
    supplier_id:           sc.supplier_id,
    supplier_candidate_id: supplierCandidateId,
    candidate_name:        sc.name,
    candidate_email:       sc.email ?? null,
    cv_path:               sc.cv_path ?? null,
    source:                'supplier',
    status:                'proposed',
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/demands/${demandId}`);
  revalidatePath('/dashboard/submissions');
  return {};
}

// Assign a candidate profile to a demand directly from the match pool (recruiter/admin/hiring_manager)
export async function assignCandidateToDemand(
  candidateProfileId: string,
  demandId: string,
): Promise<{ error?: string; alreadyExists?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter', 'hiring_manager'].includes(profile?.role ?? '')) {
    return { error: 'Not authorized' };
  }

  // Check if already submitted
  const { data: existing } = await supabase
    .from('candidate_submissions')
    .select('id')
    .eq('demand_id', demandId)
    .eq('candidate_profile_id', candidateProfileId)
    .maybeSingle();
  if (existing) return { alreadyExists: true };

  // Get candidate info
  const { data: candidateProfile } = await supabase
    .from('profiles').select('full_name, email').eq('id', candidateProfileId).single();

  const { error } = await supabase.from('candidate_submissions').insert({
    demand_id:            demandId,
    candidate_profile_id: candidateProfileId,
    candidate_name:       candidateProfile?.full_name || candidateProfile?.email || 'Unknown',
    candidate_email:      candidateProfile?.email ?? null,
    source:               'direct',
    status:               'proposed',
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/demands/${demandId}`);
  revalidatePath('/dashboard/submissions');
  return {};
}
