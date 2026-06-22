'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { DemandStatus, DemandPriority } from '@/types/database';

const STATUSES: { value: DemandStatus | 'all'; label: string }[] = [
  { value: 'all',              label: 'All' },
  { value: 'draft',            label: 'Draft' },
  { value: 'pending_review',   label: 'MSP Review' },
  { value: 'pending_approval', label: 'Approval' },
  { value: 'sourcing',         label: 'Sourcing' },
  { value: 'screening',        label: 'Screening' },
  { value: 'award',            label: 'Award' },
  { value: 'contracting',      label: 'Contracting' },
  { value: 'filled',           label: 'Filled' },
  { value: 'on_hold',          label: 'On Hold' },
  { value: 'cancelled',        label: 'Cancelled' },
];

const PRIORITIES: { value: DemandPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') ?? 'all';
  const priority = params.get('priority') ?? 'all';
  const [q, setQ] = useState(params.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setQ(params.get('q') ?? ''); }, [params]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === 'all' || value === '') next.delete(key);
    else next.set(key, value);
    router.push(`/dashboard/demands?${next.toString()}`);
  }

  function handleSearch(value: string) {
    setQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam('q', value), 350);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-6">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search demands…"
          className="w-full h-9 pl-9 pr-8 rounded-xl bg-white text-[13px] text-black placeholder:text-[#C7C7CC] shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-transparent focus:border-[#007AFF] focus:outline-none transition-colors"
        />
        {q && (
          <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C7C7CC] flex items-center justify-center text-white hover:bg-[#8E8E93] transition-colors">
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Filter controls: native selects on mobile, chip strips on desktop */}
      <div className="flex gap-2">
        <FilterGroup label="Status" options={STATUSES} value={status} onChange={v => setParam('status', v)} />
        <FilterGroup label="Priority" options={PRIORITIES} value={priority} onChange={v => setParam('priority', v)} />
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: string; onChange: (v: T) => void;
}) {
  return (
    <>
      {/* Mobile: compact native select */}
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="sm:hidden h-9 px-3 rounded-xl bg-white text-[13px] text-black shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-transparent focus:border-[#007AFF] focus:outline-none appearance-none cursor-pointer"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '28px' }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.value === 'all' ? label + ': All' : opt.label}</option>
        ))}
      </select>
      {/* Desktop: chip strip */}
      <div className="hidden sm:flex items-center gap-1 bg-white rounded-xl px-2.5 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-0.5">{label}</span>
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${value === opt.value ? 'bg-[#007AFF] text-white' : 'text-[#3C3C43] hover:bg-[#F2F2F7]'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
