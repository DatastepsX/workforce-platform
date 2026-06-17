'use client';

import { useState, useMemo, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateEngagementStatus } from '@/lib/actions/engagements';
import type { Engagement, EngagementStatus } from '@/types/database';

function countBusinessDays(start: string, end: string): number {
  try {
    const s = new Date(start); const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
    let count = 0; const cur = new Date(s);
    while (cur <= e) { const d = cur.getDay(); if (d !== 0 && d !== 6) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  } catch { return 0; }
}

function calcEngagementTotal(eng: Engagement): { total: number; duration: number; durationLabel: string } | null {
  const r = eng.rate;
  if (!r || !eng.start_date || !eng.end_date) return null;
  const businessDays = countBusinessDays(eng.start_date, eng.end_date);
  if (businessDays === 0) return null;
  if (eng.rate_type === 'daily') {
    return { total: businessDays * r, duration: businessDays, durationLabel: `${businessDays} Tage` };
  } else if (eng.rate_type === 'hourly') {
    const hours = businessDays * 8;
    return { total: hours * r, duration: hours, durationLabel: `${hours} Std.` };
  } else if (eng.rate_type === 'monthly') {
    const months = Math.round((businessDays / 21) * 10) / 10;
    return { total: months * r, duration: months, durationLabel: `${months} Mon.` };
  } else if (eng.rate_type === 'fixed') {
    return { total: r, duration: businessDays, durationLabel: `${businessDays} Tage` };
  }
  return null;
}

const STATUS_META: Record<EngagementStatus, { label: string; color: string }> = {
  active:    { label: 'Active',    color: '#34C759' },
  completed: { label: 'Completed', color: '#007AFF' },
  cancelled: { label: 'Cancelled', color: '#FF3B30' },
};

function StatusBadge({ status }: { status: EngagementStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ backgroundColor: m.color + '18', color: m.color }}>
      {m.label}
    </span>
  );
}

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EngagementRow({
  eng,
  onStatusChange,
}: {
  eng: Engagement;
  onStatusChange: (id: string, s: EngagementStatus) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showActions, setShowActions] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowActions(v => !v);
  }

  function changeStatus(s: EngagementStatus) {
    startTransition(async () => {
      await updateEngagementStatus(eng.id, s);
      onStatusChange(eng.id, s);
      setShowActions(false);
    });
  }

  return (
    <tr
      className="hover:bg-[#F9F9FB] transition-colors group cursor-pointer"
      onClick={() => router.push(`/dashboard/engagements/${eng.id}`)}
    >
      <td className="px-5 py-3.5 align-top">
        <p className="text-[14px] font-semibold text-black">{eng.candidate_name}</p>
        {eng.candidate_email && (
          <p className="text-[12px] text-[#8E8E93] mt-0.5">{eng.candidate_email}</p>
        )}
      </td>
      <td className="px-3 py-3.5 align-top">
        <Link
          href={`/dashboard/demands/${eng.demand_id}`}
          className="text-[13px] text-[#007AFF] hover:underline font-medium"
          onClick={e => e.stopPropagation()}
        >
          {eng.demand_title}
        </Link>
      </td>
      <td className="px-3 py-3.5 align-top">
        <span className="text-[13px] text-[#3C3C43]">{eng.supplier_name ?? '—'}</span>
      </td>
      <td className="px-3 py-3.5 align-top whitespace-nowrap">
        <span className="text-[12px] text-[#3C3C43]">{fmt(eng.start_date)}</span>
        {eng.end_date && <span className="text-[12px] text-[#8E8E93]"> – {fmt(eng.end_date)}</span>}
      </td>
      <td className="px-3 py-3.5 align-top whitespace-nowrap">
        {eng.rate ? (
          <span className="text-[14px] font-semibold text-black">
            {eng.currency} {eng.rate.toLocaleString()}
            <span className="text-[11px] font-normal text-[#8E8E93] ml-1">/{eng.rate_type}</span>
          </span>
        ) : (
          <span className="text-[12px] text-[#C7C7CC]">—</span>
        )}
      </td>
      {/* Duration */}
      <td className="px-3 py-3.5 align-top whitespace-nowrap">
        {(() => {
          const c = calcEngagementTotal(eng);
          return c ? (
            <span className="text-[13px] text-[#3C3C43]">{c.durationLabel}</span>
          ) : <span className="text-[12px] text-[#C7C7CC]">—</span>;
        })()}
      </td>
      {/* Total */}
      <td className="px-3 py-3.5 align-top whitespace-nowrap">
        {(() => {
          const displayTotal = eng.total_amount ?? calcEngagementTotal(eng)?.total ?? null;
          if (!displayTotal) return <span className="text-[12px] text-[#C7C7CC]">—</span>;
          return (
            <div>
              <span className="text-[14px] font-bold text-black">
                {eng.currency} {Math.round(displayTotal).toLocaleString('de-DE')}
              </span>
              {eng.price_locked && (
                <span className="ml-1.5 text-[10px] font-semibold text-[#FF9500]">●</span>
              )}
            </div>
          );
        })()}
      </td>
      <td className="px-3 py-3.5 align-top" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <StatusBadge status={eng.status} />
          <button
            ref={btnRef}
            onClick={openMenu}
            disabled={isPending}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[#C7C7CC] hover:text-[#8E8E93] hover:bg-[#F2F2F7] transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          {/* Fixed-position dropdown to avoid overflow clipping */}
          {showActions && menuPos && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
              <div
                className="fixed z-50 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#E5E5EA] overflow-hidden w-36"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                {(['active', 'completed', 'cancelled'] as EngagementStatus[])
                  .filter(s => s !== eng.status)
                  .map(s => (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      className="w-full px-3 py-2 text-left text-[13px] font-medium hover:bg-[#F2F2F7] transition-colors"
                      style={{ color: STATUS_META[s].color }}
                    >
                      {STATUS_META[s].label}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function EngagementsClient({ engagements: initial }: { engagements: Engagement[] }) {
  const [engagements, setEngagements] = useState(initial);
  const [statusFilter, setStatusFilter] = useState<EngagementStatus | 'all'>('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return engagements.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!term) return true;
      return e.candidate_name.toLowerCase().includes(term) ||
        (e.demand_title).toLowerCase().includes(term) ||
        (e.supplier_name ?? '').toLowerCase().includes(term);
    });
  }, [engagements, statusFilter, q]);

  function handleStatusChange(id: string, status: EngagementStatus) {
    setEngagements(prev => prev.map(e => e.id === id ? { ...e, status } : e));
  }

  const counts: Record<string, number> = { all: engagements.length };
  for (const e of engagements) counts[e.status] = (counts[e.status] ?? 0) + 1;

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#F2F2F7] rounded-t-2xl">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search engagements…"
            className="h-8 pl-8 pr-3 rounded-lg bg-[#F2F2F7] text-[12px] text-black placeholder:text-[#8E8E93] border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white focus:outline-none transition-colors w-48"
          />
        </div>
        <div className="flex items-center gap-1 ml-auto bg-[#F2F2F7] rounded-lg px-1.5 py-1">
          {(['all', 'active', 'completed', 'cancelled'] as const).map(v => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors capitalize ${statusFilter === v ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
            >
              {v === 'all' ? `All (${counts.all ?? 0})` : `${STATUS_META[v as EngagementStatus].label} (${counts[v] ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-[#F2F2F7]">
              {['Candidate', 'Demand', 'Supplier', 'Period', 'Rate', 'Duration', 'Total', 'Status'].map(h => (
                <th key={h} className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 first:px-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F2F7]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-[#8E8E93]">
                  {q || statusFilter !== 'all' ? 'No engagements match your filter.' : 'No engagements yet.'}
                </td>
              </tr>
            ) : filtered.map(e => (
              <EngagementRow key={e.id} eng={e} onStatusChange={handleStatusChange} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2.5 border-t border-[#F2F2F7] rounded-b-2xl">
        <span className="text-[11px] text-[#C7C7CC]">{filtered.length} of {engagements.length} · click a row to view details</span>
      </div>
    </div>
  );
}
