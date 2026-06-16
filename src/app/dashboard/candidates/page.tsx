import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { CandidateProfile, Profile, AvailabilityType, SeniorityLevel } from '@/types/database';

const AVAIL_COLORS: Record<AvailabilityType, string> = {
  immediate:     '#34C759',
  notice_period: '#FF9500',
  not_available: '#8E8E93',
};
const AVAIL_LABELS: Record<AvailabilityType, string> = {
  immediate:     'Available now',
  notice_period: 'Notice period',
  not_available: 'Unavailable',
};
const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead',
};

interface CandidateRow extends CandidateProfile {
  profile: Pick<Profile, 'id' | 'full_name' | 'email'>;
}

export default async function CandidatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter'].includes(me?.role ?? '')) redirect('/dashboard');

  const { data: cpData } = await supabase
    .from('candidate_profiles')
    .select('*')
    .order('updated_at', { ascending: false });

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

  // Fetch the profile rows for names
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
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Candidates</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">{candidates.length} profile{candidates.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {candidates.map(c => {
          const name = c.profile.full_name || c.profile.email || '—';
          const initial = name[0].toUpperCase();
          const availColor = AVAIL_COLORS[c.availability_type];

          return (
            <Link
              key={c.id}
              href={`/dashboard/candidates/${c.id}`}
              className="block bg-white rounded-2xl px-5 py-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0"
                  style={{ backgroundColor: '#007AFF' }}
                >
                  {initial}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[16px] font-bold text-black leading-tight">{name}</p>
                      {c.headline && (
                        <p className="text-[14px] text-[#3C3C43] mt-0.5">{c.headline}</p>
                      )}
                    </div>
                    {/* Availability badge */}
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1"
                      style={{ backgroundColor: availColor + '18', color: availColor }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: availColor }} />
                      {AVAIL_LABELS[c.availability_type]}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[12px] text-[#8E8E93]">
                    {c.seniority_level && <span>{SENIORITY_LABELS[c.seniority_level]}</span>}
                    {c.years_experience != null && <span>· {c.years_experience} yrs exp.</span>}
                    {c.location && <span>· {c.location}</span>}
                    {(c.hourly_rate_min || c.hourly_rate_max) && (
                      <span>
                        · {c.hourly_rate_min && c.hourly_rate_max
                          ? `${c.hourly_rate_min}–${c.hourly_rate_max} ${c.currency}/hr`
                          : c.hourly_rate_max
                          ? `up to ${c.hourly_rate_max} ${c.currency}/hr`
                          : `from ${c.hourly_rate_min} ${c.currency}/hr`}
                      </span>
                    )}
                  </div>

                  {/* Skills */}
                  {c.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {c.skills.slice(0, 6).map(s => (
                        <span key={s} className="text-[11px] bg-[#007AFF]/10 text-[#007AFF] px-2.5 py-0.5 rounded-full font-medium">
                          {s}
                        </span>
                      ))}
                      {c.skills.length > 6 && (
                        <span className="text-[11px] text-[#8E8E93]">+{c.skills.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>

                <svg className="w-4 h-4 text-[#C6C6C8] flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
