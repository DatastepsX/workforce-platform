import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { CandidateProfile, Profile, AvailabilityType, SeniorityLevel, RemotePreference } from '@/types/database';

const AVAIL_COLORS: Record<AvailabilityType, string> = {
  immediate: '#34C759', notice_period: '#FF9500', not_available: '#8E8E93',
};
const AVAIL_LABELS: Record<AvailabilityType, string> = {
  immediate: 'Available now', notice_period: 'Notice period', not_available: 'Not available',
};
const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead',
};
const REMOTE_LABELS: Record<RemotePreference, string> = {
  onsite: 'On-site', hybrid: 'Hybrid', remote: 'Full remote', flexible: 'Flexible',
};

interface PageProps { params: Promise<{ id: string }> }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F2F2F7] last:border-0">
      <span className="text-[14px] text-[#8E8E93] font-medium min-w-[160px]">{label}</span>
      <span className="text-[14px] text-black text-right flex-1">{value ?? '—'}</span>
    </div>
  );
}

export default async function CandidateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter'].includes(me?.role ?? '')) redirect('/dashboard');

  const [{ data: cpData }, { data: profileData }] = await Promise.all([
    supabase.from('candidate_profiles').select('*').eq('id', id).single(),
    supabase.from('profiles').select('full_name, email').eq('id', id).single(),
  ]);

  if (!cpData) notFound();
  const cp = cpData as CandidateProfile;
  const profile = profileData as Pick<Profile, 'full_name' | 'email'> | null;
  // Prefer candidate_profiles.full_name, then auth profile name, then derive from email alias
  const rawName = cp.full_name || profile?.full_name || profile?.email || '—';
  const name = rawName.includes('@')
    ? (() => {
        const local = rawName.split('@')[0];
        const alias = local.includes('+') ? local.split('+')[1] : local;
        return alias.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || rawName;
      })()
    : rawName;
  const initial = name[0].toUpperCase();
  const availColor = AVAIL_COLORS[cp.availability_type];

  // Generate signed CV URL
  let cvUrl: string | null = null;
  if (cp.cv_path) {
    const { data } = await supabase.storage.from('cvs').createSignedUrl(cp.cv_path, 3600);
    cvUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="px-8 py-10 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/candidates" className="hover:text-[#007AFF] transition-colors">Candidates</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-black font-medium">{name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[24px] font-bold flex-shrink-0"
            style={{ backgroundColor: '#007AFF' }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-bold tracking-tight text-black leading-tight">{name}</h1>
                {cp.headline && <p className="text-[16px] text-[#3C3C43] mt-0.5">{cp.headline}</p>}
              </div>
              <span
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full flex-shrink-0 flex items-center gap-1.5"
                style={{ backgroundColor: availColor + '18', color: availColor }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: availColor }} />
                {AVAIL_LABELS[cp.availability_type]}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[13px] text-[#8E8E93]">
              {cp.seniority_level && <span>{SENIORITY_LABELS[cp.seniority_level]}</span>}
              {cp.years_experience != null && <span>· {cp.years_experience} years exp.</span>}
              {cp.location && <span>· {cp.location}</span>}
            </div>
          </div>
        </div>

        {/* CV download */}
        {cvUrl ? (
          <a
            href={cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.25)' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download CV
          </a>
        ) : (
          <p className="mt-4 text-[13px] text-[#8E8E93]">No CV uploaded yet</p>
        )}
      </div>

      {/* Bio */}
      {cp.bio && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">About</p>
          <p className="text-[15px] text-black leading-relaxed whitespace-pre-wrap">{cp.bio}</p>
        </div>
      )}

      {/* Skills */}
      {cp.skills.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Skills</p>
          <div className="flex flex-wrap gap-2">
            {cp.skills.map(s => (
              <span key={s} className="text-[13px] bg-[#007AFF]/10 text-[#007AFF] px-3 py-1 rounded-full font-medium">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Details</p>
        <Row label="Remote Preference" value={REMOTE_LABELS[cp.remote_preference]} />
        {cp.notice_period_weeks && (
          <Row label="Notice Period" value={`${cp.notice_period_weeks} weeks`} />
        )}
        {cp.availability_date && (
          <Row label="Available From" value={new Date(cp.availability_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
        )}
        {cp.preferred_employment.length > 0 && (
          <Row label="Employment Type" value={cp.preferred_employment.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', ')} />
        )}
        {(cp.hourly_rate_min || cp.hourly_rate_max) && (
          <Row label="Hourly Rate" value={
            cp.hourly_rate_min && cp.hourly_rate_max
              ? `${cp.hourly_rate_min}–${cp.hourly_rate_max} ${cp.currency}/hr`
              : cp.hourly_rate_max
              ? `Up to ${cp.hourly_rate_max} ${cp.currency}/hr`
              : `From ${cp.hourly_rate_min} ${cp.currency}/hr`
          } />
        )}
        {cp.languages.length > 0 && (
          <Row label="Languages" value={cp.languages.join(', ')} />
        )}
      </div>

      {/* Links */}
      {(cp.linkedin_url || cp.portfolio_url) && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Links</p>
          {cp.linkedin_url && (
            <Row label="LinkedIn" value={
              <a href={cp.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="text-[#007AFF] hover:underline truncate block max-w-[200px] ml-auto">
                {cp.linkedin_url.replace('https://', '')}
              </a>
            } />
          )}
          {cp.portfolio_url && (
            <Row label="Portfolio" value={
              <a href={cp.portfolio_url} target="_blank" rel="noopener noreferrer"
                className="text-[#007AFF] hover:underline truncate block max-w-[200px] ml-auto">
                {cp.portfolio_url.replace('https://', '')}
              </a>
            } />
          )}
        </div>
      )}
    </div>
  );
}
