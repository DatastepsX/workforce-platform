'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { DemandStatus, DemandPriority } from '@/types/database';

const STATUSES: { value: DemandStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed', label: 'Closed' },
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

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    router.push(`/dashboard/demands?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <FilterGroup
        label="Status"
        options={STATUSES}
        value={status}
        onChange={v => setParam('status', v)}
      />
      <FilterGroup
        label="Priority"
        options={PRIORITIES}
        value={priority}
        onChange={v => setParam('priority', v)}
      />
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <span className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-1">
        {label}
      </span>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-lg text-[13px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-[#007AFF] text-white'
              : 'text-[#3C3C43] hover:bg-[#F2F2F7]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
