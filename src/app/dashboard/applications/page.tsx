import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { CandidateProfile, CandidateSubmission, Demand } from '@/types/database';
import { computeMatch } from '@/lib/matching';
import { ApplicationsClient, type ApplicationEntry } from './applications-client';

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'candidate') redirect('/dashboard');

  const { data: candidateProfile } = await supabase
    .from('candidate_profiles').select('*').eq('id', user.id).single();

  const { data: submissions } = await supabase
    .from('candidate_submissions')
    .select('*')
    .eq('candidate_profile_id', user.id)
    .order('submitted_at', { ascending: false });

  let entries: ApplicationEntry[] = [];

  if (submissions && submissions.length > 0) {
    const demandIds = (submissions as CandidateSubmission[]).map(s => s.demand_id);
    const adminDb = createAdminClient();
    const { data: demands } = await adminDb
      .from('demands').select('*').in('id', demandIds);

    const demandsMap = Object.fromEntries(
      ((demands ?? []) as Demand[]).map(d => [d.id, d])
    );

    entries = (submissions as CandidateSubmission[])
      .map(sub => {
        const demand = demandsMap[sub.demand_id];
        if (!demand) return null;
        const match = candidateProfile
          ? computeMatch(candidateProfile as CandidateProfile, demand)
          : { score: 0, skillScore: 0, rateScore: 0, matchedSkills: [], missingSkills: demand.skills, extraSkills: [], hasRateData: false, rateNote: null };
        return { submission: sub, demand, match };
      })
      .filter((e): e is ApplicationEntry => e !== null)
      .sort((a, b) => b.match.score - a.match.score);
  }

  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">My Applications</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">
          {entries.length > 0
            ? `${entries.length} application${entries.length !== 1 ? 's' : ''} · sorted by match score`
            : 'No applications yet'}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold text-black mb-1">No applications yet</p>
          <p className="text-[14px] text-[#8E8E93] mb-5">Browse open positions on the career portal and apply.</p>
          <a
            href="/careers"
            className="inline-block px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold"
            style={{ backgroundColor: '#007AFF' }}
          >
            Browse Positions →
          </a>
        </div>
      ) : (
        <ApplicationsClient entries={entries} />
      )}
    </div>
  );
}
