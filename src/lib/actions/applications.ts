'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { emailCandidatesSubmitted, emailApplicationConfirmation } from '@/lib/email';
import { createNotifications } from '@/lib/actions/notifications';

export interface ApplyResult {
  success?: true;
  error?: string;
  emailExists?: true;
}

export async function applyToDemand(formData: FormData): Promise<ApplyResult> {
  const demandId    = formData.get('demand_id') as string;
  const name        = (formData.get('name') as string)?.trim();
  const email       = (formData.get('email') as string)?.trim().toLowerCase();
  const phone       = (formData.get('phone') as string)?.trim() || null;
  const password    = formData.get('password') as string;
  const coverLetter = (formData.get('cover_letter') as string)?.trim() || null;
  const desiredRateRaw  = formData.get('desired_rate') as string | null;
  const desiredRate     = desiredRateRaw ? parseFloat(desiredRateRaw) || null : null;
  const desiredRateType = (formData.get('desired_rate_type') as string) || 'daily';
  const skillsRaw   = (formData.get('skills') as string)?.trim() || '';
  const skills      = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const cvFile      = formData.get('cv_file') as File | null;

  if (!demandId || !name || !email || !password) {
    return { error: 'Please fill in all required fields.' };
  }

  const admin = createAdminClient();

  // Check email uniqueness
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const alreadyExists = existing?.users.some(u => u.email?.toLowerCase() === email);
  if (alreadyExists) return { emailExists: true };

  // Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createErr || !created.user) {
    return { error: createErr?.message ?? 'Could not create account.' };
  }
  const userId = created.user.id;

  // Upload CV if provided (using admin client — user isn't authenticated yet)
  let cvPath: string | null = null;
  if (cvFile && cvFile.size > 0) {
    try {
      const ext = cvFile.name.split('.').pop() ?? 'pdf';
      const fileName = `${userId}/cv.${ext}`;
      const arrayBuffer = await cvFile.arrayBuffer();
      const { error: uploadErr } = await admin.storage
        .from('cvs')
        .upload(fileName, arrayBuffer, { contentType: cvFile.type || 'application/pdf', upsert: true });
      if (!uploadErr) cvPath = `cvs/${fileName}`;
    } catch { /* non-blocking */ }
  }

  // Profile
  await admin.from('profiles').insert({
    id: userId,
    role: 'candidate',
    full_name: name,
    email,
    phone,
  });

  // Candidate profile — include skills and CV
  await admin.from('candidate_profiles').insert({
    id: userId,
    skills,
    languages: [],
    availability_type: 'immediate',
    remote_preference: 'flexible',
    preferred_employment: [],
    currency: 'EUR',
    cv_path: cvPath,
    hourly_rate_min: desiredRate && desiredRateType === 'hourly' ? desiredRate : null,
    hourly_rate_max: desiredRate && desiredRateType === 'hourly' ? desiredRate : null,
  });

  // Submission — no supplier, source = direct
  const { error: subErr } = await admin.from('candidate_submissions').insert({
    demand_id: demandId,
    supplier_id: null,
    candidate_profile_id: userId,
    candidate_name: name,
    candidate_email: email,
    notes: coverLetter,
    source: 'direct',
    proposed_rate: desiredRate,
    rate_type: desiredRate ? desiredRateType : null,
    cv_path: cvPath,
  });
  if (subErr) return { error: subErr.message };

  // Notify recruiters
  try {
    const { data: demand } = await admin.from('demands').select('title, created_by').eq('id', demandId).single();
    const { data: recruiters } = await admin
      .from('profiles')
      .select('id, email')
      .in('role', ['recruiter', 'admin'])
      .not('email', 'is', null);

    const recruiterEmails = (recruiters ?? []).map(r => r.email as string).filter(Boolean);
    let notifyIds = (recruiters ?? []).map(r => r.id as string).filter(Boolean);

    // Also notify HM who owns the demand
    if (demand?.created_by) {
      const { data: owner } = await admin.from('profiles').select('id, role').eq('id', demand.created_by).single();
      if (owner?.role === 'hiring_manager' && !notifyIds.includes(owner.id)) {
        notifyIds = [...notifyIds, owner.id];
      }
    }

    if (demand && notifyIds.length) {
      await createNotifications({
        userIds: notifyIds,
        type: 'new_submission',
        title: `Neue Bewerbung: ${name}`,
        body: `Beworben für "${demand.title}" über Karriereportal`,
        relatedId: demandId,
        relatedType: 'demand',
      });
    }
    if (demand && recruiterEmails.length) {
      await emailCandidatesSubmitted({
        recruiterEmails,
        supplierName: 'Career Portal (Direct)',
        demandTitle: demand.title,
        demandId,
        candidateNames: [name],
      });
    }

    if (demand) {
      await emailApplicationConfirmation({
        candidateEmail: email,
        candidateName: name,
        demandTitle: demand.title,
        demandId,
      });
    }
  } catch { /* non-blocking */ }

  return { success: true };
}
