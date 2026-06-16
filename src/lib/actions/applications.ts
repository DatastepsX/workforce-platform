'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { emailCandidatesSubmitted } from '@/lib/email';

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

  // Profile
  await admin.from('profiles').insert({
    id: userId,
    role: 'candidate',
    full_name: name,
    email,
    phone,
  });

  // Candidate profile (minimal)
  await admin.from('candidate_profiles').insert({
    id: userId,
    skills: [],
    languages: [],
    availability_type: 'immediate',
    remote_preference: 'flexible',
    preferred_employment: [],
    currency: 'EUR',
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
  });
  if (subErr) return { error: subErr.message };

  // Notify recruiters
  try {
    const { data: demand } = await admin.from('demands').select('title').eq('id', demandId).single();
    const { data: recruiters } = await admin
      .from('profiles')
      .select('email')
      .in('role', ['recruiter', 'admin'])
      .not('email', 'is', null);

    const recruiterEmails = (recruiters ?? []).map(r => r.email as string).filter(Boolean);
    if (demand && recruiterEmails.length) {
      await emailCandidatesSubmitted({
        recruiterEmails,
        supplierName: 'Career Portal (Direct)',
        demandTitle: demand.title,
        demandId,
        candidateNames: [name],
      });
    }
  } catch { /* non-blocking */ }

  return { success: true };
}
