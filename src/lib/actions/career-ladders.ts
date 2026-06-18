'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createCareerLadder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.from('career_ladders').insert({
    name:        formData.get('name') as string,
    industry:    (formData.get('industry') as string) || null,
    description: (formData.get('description') as string) || null,
    created_by:  user.id,
  }).select().single();

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/career-ladders');
  redirect(`/dashboard/career-ladders/${data.id}`);
}

export async function updateCareerLadder(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get('id') as string;

  const { error } = await supabase.from('career_ladders').update({
    name:        formData.get('name') as string,
    industry:    (formData.get('industry') as string) || null,
    description: (formData.get('description') as string) || null,
    updated_at:  new Date().toISOString(),
  }).eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/career-ladders');
  revalidatePath(`/dashboard/career-ladders/${id}`);
  redirect('/dashboard/career-ladders');
}

export async function deleteCareerLadder(id: string) {
  const supabase = await createClient();
  await supabase.from('career_ladders').delete().eq('id', id);
  revalidatePath('/dashboard/career-ladders');
  redirect('/dashboard/career-ladders');
}

export interface StepInput {
  position: number;
  title: string;
  required_skills: string[];
  description: string;
}

export async function replaceCareerLadderSteps(ladderId: string, steps: StepInput[]) {
  const supabase = await createClient();

  await supabase.from('career_ladder_steps').delete().eq('ladder_id', ladderId);

  if (steps.length > 0) {
    const { error } = await supabase.from('career_ladder_steps').insert(
      steps.map(s => ({ ...s, ladder_id: ladderId }))
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/dashboard/career-ladders/${ladderId}`);
  revalidatePath('/dashboard/career-ladders');
  return { success: true };
}
