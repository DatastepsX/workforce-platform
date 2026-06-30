'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AwardPeriod } from '@/types/database';

type PeriodWithAward = AwardPeriod & {
  award?: { candidate_name: string; demand_title: string; tenant_id: string | null };
  computed_total?: number | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open:      { label: 'Open',      cls: 'bg-[#E8FAF0] text-[#34C759]'  },
  submitted: { label: 'Submitted', cls: 'bg-[#FFF4E8] text-[#FF9500]'  },
  approved:  { label: 'Approved',  cls: 'bg-[#E8F4FD] text-[#007AFF]'  },
  invoiced:  { label: 'Invoiced',  cls: 'bg-[#F0EFFE] text-[#5856D6]'  },
};

const TYPE_META: Record<string, { label: string; cls: string }> = {
  weekly:    { label: 'Weekly',     cls: 'bg-[#E8FAF0] text-[#34C759]'  },
  bi_weekly: { label: 'Bi-weekly',  cls: 'bg-[#FFF4E8] text-[#FF9500]'  },
  monthly:   { label: 'Monthly',    cls: 'bg-[#E8F4FD] text-[#007AFF]'  },
  milestone: { label: 'Milestone',  cls: 'bg-[#F0EFFE] text-[#5856D6]'  },
  fixed:     { label: 'Fixed',      cls: 'bg-[#F2F2F7] text-[#8E8E93]'  },
};

interface Props {
  periods: PeriodWithAward[];
  role: string;
  userId: string;
}

export function CostItemsInboxClient({ periods, role }: Props) {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const isStaff = ['admin','super_admin','recruiter','hiring_manager','procurement','finance'].includes(role);

  const filtered = periods.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.label.toLowerCase().includes(q) ||
        (p.award?.candidate_name ?? '').toLowerCase().includes(q) ||
        (p.award?.demand_title ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCount      = periods.filter(p => p.status === 'open').length;
  const submittedCount = periods.filter(p => p.status === 'submitted').length;
  const approvedCount  = periods.filter(p => p.status === 'approved').length;

  function fmtDate(d: string | null) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-black">Cost Items</h1>
          <p className="text-[13px] text-[#8E8E93] mt-0.5">Billing periods — timesheets, expenses and milestones</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button onClick={() => setStatusFilter(statusFilter === 'open' ? '' : 'open')}
          className={`p-4 rounded-2xl border text-left transition-all ${statusFilter === 'open' ? 'border-[#34C759] bg-[#E8FAF0]' : 'border-[#E5E5EA] bg-white'}`}>
          <div className="text-[28px] font-bold text-black">{openCount}</div>
          <div className="text-[13px] text-[#34C759] font-semibold">Open</div>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'submitted' ? '' : 'submitted')}
          className={`p-4 rounded-2xl border text-left transition-all ${statusFilter === 'submitted' ? 'border-[#FF9500] bg-[#FFF4E8]' : 'border-[#E5E5EA] bg-white'}`}>
          <div className="text-[28px] font-bold text-black">{submittedCount}</div>
          <div className="text-[13px] text-[#FF9500] font-semibold">Submitted</div>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'approved' ? '' : 'approved')}
          className={`p-4 rounded-2xl border text-left transition-all ${statusFilter === 'approved' ? 'border-[#007AFF] bg-[#E8F4FD]' : 'border-[#E5E5EA] bg-white'}`}>
          <div className="text-[28px] font-bold text-black">{approvedCount}</div>
          <div className="text-[13px] text-[#007AFF] font-semibold">Approved</div>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by period, candidate or demand…"
          className="w-full pl-10 pr-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
      </div>

      {/* Periods list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-[#8E8E93]">
            <svg className="w-12 h-12 mx-auto mb-3 text-[#C7C7CC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <p className="text-[15px] font-medium">No billing periods found</p>
            <p className="text-[13px] mt-1">Periods are generated when an award is activated with a billing period type</p>
          </div>
        )}
        {filtered.map(period => {
          const sm = STATUS_META[period.status] ?? STATUS_META.open;
          const tm = TYPE_META[period.period_type] ?? TYPE_META.monthly;
          return (
            <Link key={period.id} href={`/dashboard/cost-items/${period.id}`}
              className="flex items-center gap-4 bg-white border border-[#E5E5EA] rounded-2xl p-4 hover:border-[#007AFF]/40 hover:shadow-sm transition-all">
              {/* Period number */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[14px] bg-[#F2F2F7] text-black flex-shrink-0">
                {period.period_number}
              </div>
              {/* Label + meta */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14px] text-black">{period.label}</div>
                {period.award && (
                  <div className="text-[12px] text-[#8E8E93] truncate">
                    {period.award.candidate_name} · {period.award.demand_title}
                  </div>
                )}
                {(period.start_date || period.end_date) && (
                  <div className="text-[11px] text-[#C7C7CC] mt-0.5">
                    {fmtDate(period.start_date)}{period.end_date ? ` – ${fmtDate(period.end_date)}` : ''}
                  </div>
                )}
              </div>
              {/* Badges */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sm.cls}`}>{sm.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tm.cls}`}>{tm.label}</span>
              </div>
              {(period.computed_total != null || period.total_amount != null) && (
                <div className="text-right flex-shrink-0">
                  <div className="text-[14px] font-bold text-black">€{((period.computed_total ?? period.total_amount) ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              )}
              <svg className="w-4 h-4 text-[#C7C7CC] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          );
        })}
      </div>

      <p className="mt-4 text-[12px] text-[#8E8E93]">{filtered.length} of {periods.length} periods</p>

      {isStaff && (
        <p className="mt-2 text-[12px] text-[#8E8E93]">
          Periods are generated from the Award detail page when a billing period type is set.{' '}
          <Link href="/dashboard/awards" className="text-[#007AFF] hover:underline">View Awards →</Link>
        </p>
      )}
    </div>
  );
}
