'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { markSubmissionNotificationsRead } from '@/lib/actions/notifications';

type Submission = {
  id: string;
  demand_id: string;
  candidate_name: string;
  candidate_email: string | null;
  status: string;
  source: string;
  submitted_at: string;
  proposed_rate: number | null;
  rate_type: string | null;
  notes: string | null;
  cv_path: string | null;
  demands: { id: string; title: string } | null;
  suppliers: { company_name: string } | null;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  proposed:    { label: 'New',         color: '#007AFF' },
  shortlisted: { label: 'Shortlisted', color: '#FF9500' },
  interview:   { label: 'Interview',   color: '#5856D6' },
  offer:       { label: 'Offer',       color: '#34C759' },
  hired:       { label: 'Hired',       color: '#34C759' },
  rejected:    { label: 'Rejected',    color: '#FF3B30' },
};

const STATUS_ORDER = ['proposed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];

function fmt(d: string) {
  const now = new Date();
  const date = new Date(d);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SubmissionsInboxClient({ submissions }: { submissions: Submission[] }) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [q, setQ] = useState('');

  // Mark new_submission notifications as read when this page is viewed
  useEffect(() => {
    markSubmissionNotificationsRead();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return submissions.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && s.source !== sourceFilter) return false;
      if (!term) return true;
      return (
        s.candidate_name.toLowerCase().includes(term) ||
        (s.demands?.title ?? '').toLowerCase().includes(term) ||
        (s.suppliers?.company_name ?? '').toLowerCase().includes(term) ||
        (s.candidate_email ?? '').toLowerCase().includes(term)
      );
    });
  }, [submissions, statusFilter, sourceFilter, q]);

  const counts: Record<string, number> = { all: submissions.length };
  for (const s of submissions) counts[s.status] = (counts[s.status] ?? 0) + 1;

  const newCount = counts['proposed'] ?? 0;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, demand, supplier…"
            className="w-full h-9 pl-9 pr-8 rounded-xl bg-white text-[13px] text-black placeholder:text-[#C7C7CC] shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-transparent focus:border-[#007AFF] focus:outline-none transition-colors"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C7C7CC] flex items-center justify-center text-white hover:bg-[#8E8E93] transition-colors">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-white rounded-xl px-2.5 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-0.5">Source</span>
          {(['all', 'direct', 'supplier'] as const).map(v => (
            <button key={v} onClick={() => setSourceFilter(v)}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium capitalize transition-colors ${sourceFilter === v ? 'bg-[#007AFF] text-white' : 'text-[#3C3C43] hover:bg-[#F2F2F7]'}`}
            >
              {v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${statusFilter === 'all' ? 'bg-black text-white' : 'bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'} shadow-[0_1px_4px_rgba(0,0,0,0.06)]`}
        >
          All ({submissions.length})
        </button>
        {newCount > 0 && (
          <button
            onClick={() => setStatusFilter('proposed')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${statusFilter === 'proposed' ? 'bg-[#007AFF] text-white' : 'bg-white text-[#007AFF] hover:bg-[#007AFF]/8'} shadow-[0_1px_4px_rgba(0,0,0,0.06)]`}
          >
            New ({newCount})
          </button>
        )}
        {STATUS_ORDER.filter(s => s !== 'proposed' && (counts[s] ?? 0) > 0).map(s => {
          const meta = STATUS_META[s] ?? { label: s, color: '#8E8E93' };
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${statusFilter === s ? 'text-white' : 'bg-white'}`}
              style={statusFilter === s ? { backgroundColor: meta.color } : { color: meta.color }}
            >
              {meta.label} ({counts[s] ?? 0})
            </button>
          );
        })}
      </div>

      <p className="text-[13px] text-[#8E8E93] mb-4">{filtered.length} of {submissions.length}</p>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[16px] font-semibold text-black mb-1">No submissions match</p>
          <p className="text-[14px] text-[#8E8E93]">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          {filtered.map((s, i) => {
            const meta = STATUS_META[s.status] ?? { label: s.status, color: '#8E8E93' };
            const isNew = s.status === 'proposed';
            return (
              <div key={s.id}>
                {i > 0 && <div className="ml-5 h-px bg-[#F2F2F7]" />}
                <Link
                  href={`/dashboard/demands/${s.demand_id}#submissions`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[#F9F9FB] transition-colors"
                >
                  {/* New indicator */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isNew ? 'bg-[#007AFF]' : 'bg-transparent'}`} />

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                    style={{ backgroundColor: isNew ? '#007AFF' : '#8E8E93' }}
                  >
                    {s.candidate_name[0]?.toUpperCase() ?? '?'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-[14px] font-semibold truncate ${isNew ? 'text-black' : 'text-[#3C3C43]'}`}>
                        {s.candidate_name}
                      </p>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: meta.color + '18', color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {s.source === 'direct' && (
                        <span className="text-[11px] bg-[#34C759]/10 text-[#34C759] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                          Direct
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-[#8E8E93] min-w-0">
                      <span className="truncate">
                        {s.demands?.title ?? 'Unknown demand'}
                      </span>
                      {s.suppliers?.company_name && (
                        <>
                          <span className="flex-shrink-0">·</span>
                          <span className="flex-shrink-0">{s.suppliers.company_name}</span>
                        </>
                      )}
                      {s.proposed_rate && (
                        <>
                          <span className="flex-shrink-0">·</span>
                          <span className="flex-shrink-0">€{s.proposed_rate.toLocaleString()}/{s.rate_type}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Date + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[12px] ${isNew ? 'text-[#007AFF] font-medium' : 'text-[#8E8E93]'}`}>
                      {fmt(s.submitted_at)}
                    </span>
                    <svg className="w-4 h-4 text-[#C6C6C8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
