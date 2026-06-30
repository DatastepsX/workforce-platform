'use client';

import { useState } from 'react';
import type { MatchResult } from '@/lib/matching';
import { matchColor } from '@/lib/matching';
import type { CandidateSubmission, Demand, SubmissionStatus } from '@/types/database';

export interface ApplicationEntry {
  submission: CandidateSubmission;
  demand: Demand;
  match: MatchResult;
}

const STATUS_META: Record<SubmissionStatus, { label: string; color: string }> = {
  proposed:   { label: 'Applied',       color: '#007AFF' },
  shortlisted:{ label: 'Shortlisted',   color: '#FF9500' },
  interview:  { label: 'Interview',     color: '#AF52DE' },
  offer:      { label: 'Offer received',color: '#34C759' },
  hired:      { label: 'Hired',         color: '#34C759' },
  awarded:    { label: 'Awarded',       color: '#AF52DE' },
  rejected:   { label: 'Not selected',  color: '#FF3B30' },
};

const CONTRACT_LABELS: Record<string, string> = {
  permanent:  'Permanent',
  freelance:  'Freelance',
  contractor: 'Contractor',
  internship: 'Internship',
};

function ScoreBadge({ score, onClick }: { score: number; onClick: () => void }) {
  const color = matchColor(score);
  return (
    <button
      onClick={onClick}
      title="Click for match breakdown"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-semibold text-[13px] transition-opacity hover:opacity-80 focus:outline-none"
      style={{ backgroundColor: color + '18', color }}
    >
      <span>{score}%</span>
      <svg className="w-3 h-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
      </svg>
    </button>
  );
}

function MatchModal({ entry, onClose }: { entry: ApplicationEntry; onClose: () => void }) {
  const { match, demand } = entry;
  const color = matchColor(match.score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
      <div
        className="relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.16)] w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#F2F2F7]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-0.5">Match Score</p>
              <h2 className="text-[16px] font-bold text-black leading-snug">{demand.title}</h2>
            </div>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-[22px] flex-shrink-0"
              style={{ backgroundColor: color + '15', color }}
            >
              {match.score}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Skills breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-semibold text-black">Skills</p>
              <span className="text-[12px] text-[#8E8E93]">
                {match.matchedSkills.length} / {demand.skills.length} required
              </span>
            </div>

            {/* Score bar */}
            <div className="h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${demand.skills.length > 0 ? (match.matchedSkills.length / demand.skills.length) * 100 : 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>

            {match.matchedSkills.length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] font-medium text-[#34C759] mb-1.5">Matched</p>
                <div className="flex flex-wrap gap-1.5">
                  {match.matchedSkills.map(s => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {match.missingSkills.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[#FF3B30] mb-1.5">Missing</p>
                <div className="flex flex-wrap gap-1.5">
                  {match.missingSkills.map(s => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {demand.skills.length === 0 && (
              <p className="text-[12px] text-[#8E8E93]">No specific skills listed for this position.</p>
            )}
          </div>

          {/* Rate breakdown */}
          {match.hasRateData && (
            <div className="pt-3 border-t border-[#F2F2F7]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-black">Rate</p>
                <span className="text-[12px] font-semibold" style={{ color: match.rateScore >= 25 ? '#34C759' : '#FF9500' }}>
                  +{match.rateScore} pts
                </span>
              </div>
              <p className="text-[12px] text-[#8E8E93] leading-relaxed">{match.rateNote}</p>
            </div>
          )}

          {/* Extra skills */}
          {match.extraSkills.length > 0 && (
            <div className="pt-3 border-t border-[#F2F2F7]">
              <p className="text-[12px] font-medium text-[#8E8E93] mb-1.5">Additional skills you bring</p>
              <div className="flex flex-wrap gap-1.5">
                {match.extraSkills.slice(0, 8).map(s => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F2F2F7] text-[#3C3C43] font-medium">{s}</span>
                ))}
                {match.extraSkills.length > 8 && (
                  <span className="text-[11px] text-[#8E8E93]">+{match.extraSkills.length - 8} more</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-[10px] bg-[#F2F2F7] text-[14px] font-semibold text-black hover:bg-[#E5E5EA] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ApplicationsClient({ entries }: { entries: ApplicationEntry[] }) {
  const [activeEntry, setActiveEntry] = useState<ApplicationEntry | null>(null);

  return (
    <>
      <div className="space-y-3">
        {entries.map(entry => {
          const { submission, demand, match } = entry;
          const statusMeta = STATUS_META[submission.status];

          return (
            <div
              key={submission.id}
              className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
            >
              {/* Top row: status + match score */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: statusMeta.color + '18', color: statusMeta.color }}
                >
                  {statusMeta.label}
                </span>
                <ScoreBadge score={match.score} onClick={() => setActiveEntry(entry)} />
              </div>

              {/* Demand title */}
              <h2 className="text-[18px] font-bold text-black mb-1 leading-snug">{demand.title}</h2>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-[#8E8E93] mb-3">
                <span>{CONTRACT_LABELS[demand.contract_type] ?? demand.contract_type}</span>
                {demand.location && (
                  <span>· {demand.location}{demand.remote_allowed ? ' (Remote OK)' : ''}</span>
                )}
                {(demand.start_date || demand.end_date) && (
                  <span>· {demand.start_date ? fmt(demand.start_date) : '?'}{demand.end_date ? ` – ${fmt(demand.end_date)}` : ''}</span>
                )}
              </div>

              {/* Skills preview */}
              {demand.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {demand.skills.map(skill => {
                    const matched = match.matchedSkills.map(s => s.toLowerCase()).includes(skill.toLowerCase());
                    return (
                      <span
                        key={skill}
                        className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: matched ? '#34C759' + '18' : '#F2F2F7',
                          color: matched ? '#34C759' : '#8E8E93',
                        }}
                      >
                        {skill}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Applied date */}
              <p className="text-[12px] text-[#C7C7CC]">
                Applied {fmt(submission.submitted_at)}
              </p>
            </div>
          );
        })}
      </div>

      {activeEntry && (
        <MatchModal entry={activeEntry} onClose={() => setActiveEntry(null)} />
      )}
    </>
  );
}
