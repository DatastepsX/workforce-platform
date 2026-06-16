'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { AvailabilityType, RemotePreference, SeniorityLevel } from '@/types/database';

export async function upsertCandidateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const split = (key: string) =>
    (formData.get(key) as string ?? '').split(',').map(s => s.trim()).filter(Boolean);

  const { error } = await supabase.from('candidate_profiles').upsert({
    id: user.id,
    headline:             (formData.get('headline') as string) || null,
    bio:                  (formData.get('bio') as string) || null,
    skills:               split('skills'),
    years_experience:     formData.get('years_experience') ? Number(formData.get('years_experience')) : null,
    seniority_level:      (formData.get('seniority_level') as SeniorityLevel) || null,
    availability_type:    (formData.get('availability_type') as AvailabilityType) || 'not_available',
    availability_date:    (formData.get('availability_date') as string) || null,
    notice_period_weeks:  formData.get('notice_period_weeks') ? Number(formData.get('notice_period_weeks')) : null,
    location:             (formData.get('location') as string) || null,
    remote_preference:    (formData.get('remote_preference') as RemotePreference) || 'flexible',
    languages:            split('languages'),
    hourly_rate_min:      formData.get('hourly_rate_min') ? Number(formData.get('hourly_rate_min')) : null,
    hourly_rate_max:      formData.get('hourly_rate_max') ? Number(formData.get('hourly_rate_max')) : null,
    currency:             (formData.get('currency') as string) || 'EUR',
    linkedin_url:         (formData.get('linkedin_url') as string) || null,
    portfolio_url:        (formData.get('portfolio_url') as string) || null,
    preferred_employment: split('preferred_employment'),
    cv_path:              (formData.get('cv_path') as string) || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard/candidates');
  return { success: true };
}
