'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CandidateProfile, Profile, AvailabilityType, SeniorityLevel } from '@/types/database';

const AVAIL_COLORS: Record<AvailabilityType, string> = {
  immediate: '#34C759', notice_period: '#FF9500', not_available: '#8E8E93',
};
const AVAIL_LABELS: Record<AvailabilityType, string> = {
  immediate: 'Available now', notice_period: 'Notice period', not_available: 'Unavailable',
};
const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead',
};

export interface CandidateRow extends CandidateProfile {
  profile: Pick<Profile, 'id' | 'full_name' | 'email'>;
}

const AVAIL_FILTERS: { value: AvailabilityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'immediate', label: 'Available' },
  { value: 'notice_period', label: 'Notice' },
  { value: 'not_available', label: 'Unavailable' },
];

const SENIORITY_FILTERS: { value: SeniorityLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
];

export function CandidatesListClient({ candidates }: { candidates: CandidateRow[] }) {
  const [q, setQ] = useState('');
  const [avail, setAvail] = useState<AvailabilityType | 'all'>('all');
  const [seniority, setSeniority] = useState<SeniorityLevel | 'all'>('all');

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return candidates.filter(c => {
      if (avail !== 'all' && c.availability_type !== avail) return false;
      if (seniority !== 'all' && c.seniority_level !== seniority) return false;
      if (!term) return true;
      const name = (c.profile.full_name || c.profile.email || '').toLowerCase();
      const headline = (c.headline || '').toLowerCase();
      const skills = c.skills.join(' ').toLowerCase();
      const location = (c.location || '').toLowerCase();
      return name.includes(term) || headline.includes(term) || skills.includes(term) || location.includes(term);
    });
  }, [candidates, q, avail, seniority]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search candidates…"
            className="w-full h-9 pl-9 pr-8 rounded-xl bg-white text-[13px] text-black placeholder:text-[#C7C7CC] shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-transparent focus:border-[#007AFF] focus:outline-none transition-colors"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C7C7CC] flex items-center justify-center text-white hover:bg-[#8E8E93] transition-colors">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ChipGroup label="Availability" options={AVAIL_FILTERS} value={avail} onChange={setAvail} />
          <ChipGroup label="Seniority" options={SENIORITY_FILTERS} value={seniority} onChange={setSeniority} />
        </div>
      </div>

      <p className="text-[13px] text-[#8E8E93] mb-4">
        {filtered.length} of {candidates.length} profile{candidates.length !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[16px] font-semibold text-black mb-1">No candidates match</p>
          <p className="text-[14px] text-[#8E8E93]">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
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
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0" style={{ backgroundColor: '#007AFF' }}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[16px] font-bold text-black leading-tight">{name}</p>
                        {c.headline && <p className="text-[14px] text-[#3C3C43] mt-0.5">{c.headline}</p>}
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1" style={{ backgroundColor: availColor + '18', color: availColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: availColor }} />
                        {AVAIL_LABELS[c.availability_type]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[12px] text-[#8E8E93]">
                      {c.seniority_level && <span>{SENIORITY_LABELS[c.seniority_level]}</span>}
                      {c.years_experience != null && <span>· {c.years_experience} yrs exp.</span>}
                      {c.location && <span>· {c.location}</span>}
                      {(c.hourly_rate_min || c.hourly_rate_max) && (
                        <span>· {c.hourly_rate_min && c.hourly_rate_max
                          ? `${c.hourly_rate_min}–${c.hourly_rate_max} ${c.currency}/hr`
                          : c.hourly_rate_max ? `up to ${c.hourly_rate_max} ${c.currency}/hr`
                          : `from ${c.hourly_rate_min} ${c.currency}/hr`}</span>
                      )}
                    </div>
                    {c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {c.skills.slice(0, 6).map(s => (
                          <span key={s} className="text-[11px] bg-[#007AFF]/10 text-[#007AFF] px-2.5 py-0.5 rounded-full font-medium">{s}</span>
                        ))}
                        {c.skills.length > 6 && <span className="text-[11px] text-[#8E8E93]">+{c.skills.length - 6}</span>}
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
      )}
    </div>
  );
}

function ChipGroup<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: string; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-white rounded-xl px-2.5 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-0.5">{label}</span>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${value === opt.value ? 'bg-[#007AFF] text-white' : 'text-[#3C3C43] hover:bg-[#F2F2F7]'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
