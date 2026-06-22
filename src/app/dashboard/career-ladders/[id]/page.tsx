import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import type { CareerLadder, CareerLadderStep } from '@/types/database';
import { LadderEditForm } from './ladder-edit-form';

interface PageProps { params: Promise<{ id: string }> }

export default async function CareerLadderEditPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['super_admin', 'admin', 'recruiter'].includes(me?.role ?? '')) redirect('/dashboard');

  const [{ data: ladderData }, { data: stepsData }] = await Promise.all([
    supabase.from('career_ladders').select('*').eq('id', id).single(),
    supabase.from('career_ladder_steps').select('*').eq('ladder_id', id).order('position'),
  ]);

  if (!ladderData) notFound();

  return (
    <LadderEditForm
      ladder={ladderData as CareerLadder}
      steps={(stepsData ?? []) as CareerLadderStep[]}
    />
  );
}
