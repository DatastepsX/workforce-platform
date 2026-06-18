'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { SoftSkill } from '@/types/database';

export async function saveAvatarSelfAssessment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const preferred_positions = (formData.get('preferred_positions') as string ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const { error } = await supabase.from('candidate_profiles').update({
    career_goals:         (formData.get('career_goals') as string) || null,
    preferred_positions,
    strengths:            (formData.get('strengths') as string) || null,
    weaknesses:           (formData.get('weaknesses') as string) || null,
    motivation:           (formData.get('motivation') as string) || null,
    learning_willingness: formData.get('learning_willingness')
      ? Number(formData.get('learning_willingness')) : null,
  }).eq('id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/profile');
  return { success: true };
}

export async function saveSoftSkillRatings(ratings: Record<SoftSkill, number | null>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const upserts = (Object.entries(ratings) as [SoftSkill, number | null][])
    .filter(([, v]) => v !== null)
    .map(([skill, self_rating]) => ({
      candidate_profile_id: user.id,
      skill,
      self_rating,
      updated_at: new Date().toISOString(),
    }));

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('soft_skill_ratings')
      .upsert(upserts, { onConflict: 'candidate_profile_id,skill' });
    if (error) return { error: error.message };
  }

  revalidatePath('/dashboard/profile');
  return { success: true };
}

export async function toggleAvatarVisibility(visible: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase.from('candidate_profiles')
    .update({ avatar_visible_to_recruiters: visible }).eq('id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard/candidates');
  return { success: true };
}
