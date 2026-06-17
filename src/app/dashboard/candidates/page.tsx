import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { CandidateProfile, Demand, Profile } from '@/types/database';
import { CandidatesListClient } from './candidates-list-client';
import type { CandidateRow } from './candidates-list-client';

export default async function CandidatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter'].includes(me?.role ?? '')) redirect('/dashboard');

  const [{ data: cpData }, { data: demandsData }] = await Promise.all([
    supabase.from('candidate_profiles').select('*').order('updated_at', { ascending: false }),
    supabase.from('demands').select('*').eq('status', 'open').order('updated_at', { ascending: false }),
  ]);

  const openDemands = (demandsData ?? []) as Demand[];

  if (!cpData?.length) {
    return (
      <div className="px-8 py-10">
        <h1 className="text-[34px] font-bold tracking-tight text-black mb-2">Candidates</h1>
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)] mt-6">
          <p className="text-[17px] font-semibold text-black mb-1">No candidate profiles yet</p>
          <p className="text-[15px] text-[#8E8E93]">Candidates will appear here once they complete their profile.</p>
        </div>
      </div>
    );
  }

  const ids = cpData.map(cp => cp.id);
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids);

  const profileMap = Object.fromEntries(
    ((profilesData ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[]).map(p => [p.id, p])
  );

  const candidates: CandidateRow[] = (cpData as CandidateProfile[])
    .map(cp => ({ ...cp, profile: profileMap[cp.id] }))
    .filter(c => c.profile);

  return (
    <div className="px-8 py-10">
      <div className="mb-6">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Candidates</h1>
      </div>
      <CandidatesListClient candidates={candidates} openDemands={openDemands} />
    </div>
  );
}
