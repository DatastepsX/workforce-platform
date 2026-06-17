'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { computeMatch, matchColor } from '@/lib/matching';
import type { CandidateProfile, Demand, Profile, AvailabilityType, SeniorityLevel } from '@/types/database';

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

const MIN_SCORE_FILTERS = [
  { value: 0,  label: 'All' },
  { value: 80, label: '80+' },
  { value: 60, label: '60+' },
  { value: 40, label: '40+' },
];

export function CandidatesListClient({
  candidates,
  openDemands,
}: {
  candidates: CandidateRow[];
  openDemands: Demand[];
}) {
  const [tab, setTab] = useState<'profiles' | 'pool'>('profiles');
  const [q, setQ] = useState('');
  const [avail, setAvail] = useState<AvailabilityType | 'all'>('all');
  const [seniority, setSeniority] = useState<SeniorityLevel | 'all'>('all');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  // match pool filters
  const [minScore, setMinScore] = useState(0);
  const [demandFilter, setDemandFilter] = useState<string>('all');

  const allSkills = useMemo(() => {
    const seen: string[] = [];
    candidates.forEach(c => c.skills.forEach(s => {
      if (!seen.includes(s)) seen.push(s);
    }));
    return seen.sort();
  }, [candidates]);

  function toggleSkill(skill: string) {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  }

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return candidates.filter(c => {
      if (avail !== 'all' && c.availability_type !== avail) return false;
      if (seniority !== 'all' && c.seniority_level !== seniority) return false;
      if (selectedSkills.length > 0) {
        const hasAny = selectedSkills.some(sk =>
          c.skills.map(s => s.toLowerCase()).includes(sk.toLowerCase())
        );
        if (!hasAny) return false;
      }
      if (!term) return true;
      const name = (c.profile.full_name || c.profile.email || '').toLowerCase();
      const headline = (c.headline || '').toLowerCase();
      const skills = c.skills.join(' ').toLowerCase();
      const location = (c.location || '').toLowerCase();
      return name.includes(term) || headline.includes(term) || skills.includes(term) || location.includes(term);
    });
  }, [candidates, q, avail, seniority, selectedSkills]);

  // Match pool: all candidate×demand pairs
  const matchPairs = useMemo(() => {
    if (openDemands.length === 0) return [];
    const pairs: Array<{
      key: string;
      candidate: CandidateRow;
      demand: Demand;
      score: number;
      matchedCount: number;
      missingCount: number;
    }> = [];
    for (const c of candidates) {
      for (const d of openDemands) {
        if (demandFilter !== 'all' && d.id !== demandFilter) continue;
        const r = computeMatch(c, d);
        if (r.score < minScore) continue;
        pairs.push({
          key: `${c.id}:${d.id}`,
          candidate: c,
          demand: d,
          score: r.score,
          matchedCount: r.matchedSkills.length,
          missingCount: r.missingSkills.length,
        });
      }
    }
    return pairs.sort((a, b) => b.score - a.score);
  }, [candidates, openDemands, minScore, demandFilter]);

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-[#F2F2F7] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('profiles')}
          className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${tab === 'profiles' ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
        >
          Profiles
          <span className={`ml-1.5 text-[11px] font-medium ${tab === 'profiles' ? 'text-[#8E8E93]' : 'text-[#C7C7CC]'}`}>{candidates.length}</span>
        </button>
        {openDemands.length > 0 && (
          <button
            onClick={() => setTab('pool')}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${tab === 'pool' ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
          >
            Match Pool
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#007AFF] text-white">{openDemands.length} open</span>
          </button>
        )}
      </div>

      {tab === 'profiles' ? (
        <>
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
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

          {/* Skill chips */}
          {allSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {allSkills.map(skill => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`text-[12px] font-medium px-3 py-1 rounded-full transition-colors border ${
                    selectedSkills.includes(skill)
                      ? 'bg-[#007AFF] text-white border-[#007AFF]'
                      : 'bg-white text-[#3C3C43] border-[#E5E5EA] hover:border-[#007AFF] hover:text-[#007AFF]'
                  }`}
                >
                  {skill}
                </button>
              ))}
              {selectedSkills.length > 0 && (
                <button onClick={() => setSelectedSkills([])} className="text-[12px] text-[#FF3B30] hover:opacity-70 transition-opacity ml-1">
                  Clear
                </button>
              )}
            </div>
          )}

          <p className="text-[13px] text-[#8E8E93] mb-4">
            {filtered.length} of {candidates.length} profile{candidates.length !== 1 ? 's' : ''}
            {selectedSkills.length > 0 && ` · with ${selectedSkills.join(', ')}`}
          </p>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[16px] font-semibold text-black mb-1">No candidates match</p>
              <p className="text-[14px] text-[#8E8E93]">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(c => {
                const displayName = c.profile.full_name || c.profile.email || '—';
                const initial = displayName[0].toUpperCase();
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
                            <p className="text-[16px] font-bold text-black leading-tight">{displayName}</p>
                            {c.profile.full_name && c.profile.email && (
                              <p className="text-[12px] text-[#8E8E93] leading-tight mt-0.5">{c.profile.email}</p>
                            )}
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
                              <span key={s} className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${selectedSkills.includes(s) ? 'bg-[#007AFF] text-white' : 'bg-[#007AFF]/10 text-[#007AFF]'}`}>{s}</span>
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
        </>
      ) : (
        // ── Match Pool ───────────────────────────────────────────────────
        <MatchPoolView
          pairs={matchPairs}
          openDemands={openDemands}
          minScore={minScore}
          setMinScore={setMinScore}
          demandFilter={demandFilter}
          setDemandFilter={setDemandFilter}
        />
      )}
    </div>
  );
}

function MatchPoolView({
  pairs,
  openDemands,
  minScore,
  setMinScore,
  demandFilter,
  setDemandFilter,
}: {
  pairs: Array<{
    key: string;
    candidate: CandidateRow;
    demand: Demand;
    score: number;
    matchedCount: number;
    missingCount: number;
  }>;
  openDemands: Demand[];
  minScore: number;
  setMinScore: (v: number) => void;
  demandFilter: string;
  setDemandFilter: (v: string) => void;
}) {
  return (
    <div>
      {/* Match pool filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1 bg-white rounded-xl px-2.5 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-0.5">Score</span>
          {MIN_SCORE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setMinScore(f.value)}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${minScore === f.value ? 'bg-[#007AFF] text-white' : 'text-[#3C3C43] hover:bg-[#F2F2F7]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={demandFilter}
          onChange={e => setDemandFilter(e.target.value)}
          className="h-9 px-3 rounded-xl bg-white text-[13px] text-black shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-transparent focus:border-[#007AFF] focus:outline-none transition-colors"
        >
          <option value="all">All open demands</option>
          {openDemands.map(d => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>

        <p className="text-[13px] text-[#8E8E93] ml-auto">
          {pairs.length} match{pairs.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {pairs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold text-black mb-1">No matches found</p>
          <p className="text-[14px] text-[#8E8E93]">Try lowering the minimum score threshold.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pairs.slice(0, 150).map(pair => {
            const color = matchColor(pair.score);
            const displayName = pair.candidate.profile.full_name || pair.candidate.profile.email || '—';
            const initial = displayName[0]?.toUpperCase() ?? '?';
            const totalDemandSkills = pair.demand.skills.length;
            const barPct = totalDemandSkills > 0 ? (pair.matchedCount / totalDemandSkills) * 100 : 100;
            return (
              <div
                key={pair.key}
                className="bg-white rounded-2xl px-5 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] flex items-center gap-4"
              >
                {/* Score badge */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-[18px] text-white flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {pair.score}
                </div>

                {/* Candidate */}
                <Link
                  href={`/dashboard/candidates/${pair.candidate.id}`}
                  className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-[12px] font-bold">
                    {initial}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-black leading-tight">{displayName}</p>
                    {pair.candidate.headline && (
                      <p className="text-[11px] text-[#8E8E93] leading-tight">{pair.candidate.headline}</p>
                    )}
                  </div>
                </Link>

                {/* Arrow */}
                <svg className="w-4 h-4 text-[#C7C7CC] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>

                {/* Demand */}
                <Link
                  href={`/dashboard/demands/${pair.demand.id}`}
                  className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="text-[14px] font-semibold text-black truncate">{pair.demand.title}</p>
                  {totalDemandSkills > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 max-w-[100px] h-1.5 rounded-full bg-[#F2F2F7] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-[11px] text-[#8E8E93] whitespace-nowrap">
                        {pair.matchedCount}/{totalDemandSkills} skills
                      </span>
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
          {pairs.length > 150 && (
            <p className="text-[12px] text-[#8E8E93] text-center py-2">
              Showing top 150 of {pairs.length} matches — increase the score filter to narrow results
            </p>
          )}
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
