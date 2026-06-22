'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { SubmissionInterview } from '@/types/database';

export async function addInterview(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const submissionId = formData.get('submission_id') as string;
  const demandId = formData.get('demand_id') as string;
  if (!submissionId || !demandId) return { error: 'Missing submission or demand ID' };

  const ratingRaw = formData.get('rating') as string;
  const rating = ratingRaw ? parseInt(ratingRaw, 10) : null;

  const { data, error } = await supabase
    .from('submission_interviews')
    .insert({
      submission_id: submissionId,
      demand_id: demandId,
      interviewer_name: (formData.get('interviewer_name') as string) || null,
      interview_date: (formData.get('interview_date') as string) || null,
      interview_type: (formData.get('interview_type') as string) || 'video',
      rating: rating && !isNaN(rating) && rating >= 1 && rating <= 5 ? rating : null,
      notes: (formData.get('notes') as string) || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/demands/${demandId}`);
  return { success: true, interview: data as SubmissionInterview };
}

export async function updateInterview(
  id: string,
  demandId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const ratingRaw = formData.get('rating') as string;
  const rating = ratingRaw ? parseInt(ratingRaw, 10) : null;

  const { data, error } = await supabase
    .from('submission_interviews')
    .update({
      interviewer_name: (formData.get('interviewer_name') as string) || null,
      interview_date: (formData.get('interview_date') as string) || null,
      interview_type: (formData.get('interview_type') as string) || 'video',
      rating: rating && !isNaN(rating) && rating >= 1 && rating <= 5 ? rating : null,
      notes: (formData.get('notes') as string) || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/demands/${demandId}`);
  return { success: true, interview: data as SubmissionInterview };
}

export async function deleteInterview(id: string, demandId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('submission_interviews')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/demands/${demandId}`);
  return { success: true };
}
