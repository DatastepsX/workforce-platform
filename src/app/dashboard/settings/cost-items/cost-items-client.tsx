'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { CostItemWithMeta } from '@/lib/actions/cost-items';
import type { CostItemContractType } from '@/types/database';

const CONTRACT_TABS: { value: CostItemContractType | 'all'; label: string }[] = [
  { value: 'all',         label: 'All'         },
  { value: 'temp',        label: 'Temp'        },
  { value: 'contracting', label: 'Contracting' },
  { value: 'sow',         label: 'SOW'         },
  { value: 'perm',        label: 'Perm'        },
];

const CONTRACT_COLORS: Record<CostItemContractType, string> = {
  perm:        'bg-[#E8F4FD] text-[#007AFF]',
  temp:        'bg-[#E8FAF0] text-[#34C759]',
  contracting: 'bg-[#FFF4E8] text-[#FF9500]',
  sow:         'bg-[#F0EFFE] text-[#5856D6]',
};

const CONTRACT_LABELS: Record<CostItemContractType, string> = {
  perm:        'Perm',
  temp:        'Temp',
  contracting: 'Contract',
  sow:         'SOW',
};

const BILLING_LABELS: Record<string, string> = {
  hourly:     'Hourly',
  daily:      'Daily',
  fixed:      'Fixed',
  percentage: '%',
  milestone:  'Milestone',
  unit:       'Unit',
};

interface Props {
  items: CostItemWithMeta[];
  onDelete: (id: string) => Promise<void>;
}

export function CostItemsClient({ items, onDelete }: Props) {
  const [tab, setTab] = useState<CostItemContractType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = items.filter(item => {
    if (tab !== 'all' && !item.contract_types.includes(tab)) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || (item.category?.name ?? '').toLowerCase().includes(q);
  });

  function handleDelete(id: string) {
    if (!confirm('Delete this cost item? This cannot be undone.')) return;
    setDeletingId(id);
    startTransition(async () => {
      await onDelete(id);
      setDeletingId(null);
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-black">Cost Items</h1>
          <p className="text-[13px] text-[#8E8E93] mt-0.5">Configure billable cost items by contract type</p>
        </div>
        <Link href="/dashboard/settings/cost-items/new" className="flex items-center gap-1.5 px-3 py-2 md:px-4 rounded-xl text-white text-[13px] md:text-[14px] font-semibold" style={{ backgroundColor: '#007AFF' }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          <span className="hidden sm:inline">New Cost Item</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="flex gap-1 mb-4 bg-[#F2F2F7] p-1 rounded-xl overflow-x-auto no-scrollbar">
        {CONTRACT_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-[12px] md:text-[13px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${tab === t.value ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93]'}`}
          >
            {t.label}
            {t.value !== 'all' && (
              <span className="ml-1 text-[10px] md:text-[11px]">
                ({items.filter(i => i.contract_types.includes(t.value as CostItemContractType)).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by code, name or category…"
          className="w-full pl-10 pr-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30"
        />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <p className="text-center py-10 text-[#8E8E93] text-[14px]">No cost items found</p>
        )}
        {filtered.map(item => (
          <div key={item.id} className="bg-white border border-[#E5E5EA] rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[12px] font-semibold text-[#007AFF] bg-[#E8F4FD] px-2 py-0.5 rounded-md">{item.code}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.active ? 'bg-[#E8FAF0] text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                  {item.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={`/dashboard/settings/cost-items/${item.id}`} className="text-[#007AFF] text-[12px] font-semibold hover:underline">Edit</Link>
                <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                  className="text-[#FF3B30] text-[12px] font-semibold hover:underline disabled:opacity-40">
                  {deletingId === item.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
            <p className="text-[14px] font-semibold text-black">{item.name}</p>
            {item.description && <p className="text-[12px] text-[#8E8E93] mt-0.5 line-clamp-2">{item.description}</p>}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {item.category && <span className="text-[11px] text-[#8E8E93]">{item.category.name}</span>}
              {item.billing_type && <span className="text-[11px] text-[#8E8E93]">· {BILLING_LABELS[item.billing_type] ?? item.billing_type}</span>}
              {item.countries.length > 0 && <span className="text-[11px] text-[#8E8E93]">· {item.countries.join(', ')}</span>}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {item.contract_types.map(ct => (
                <span key={ct} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONTRACT_COLORS[ct]}`}>
                  {CONTRACT_LABELS[ct]}
                </span>
              ))}
              {item.markup_eligible && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FFF4E8] text-[#FF9500]">Markup</span>}
              {item.pass_through && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F0EFFE] text-[#5856D6]">Pass-thru</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#F2F2F7] bg-[#F9F9FB]">
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Code</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Category</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Contract Types</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Billing</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Flags</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Countries</th>
              <th className="text-right px-4 py-3 font-semibold text-[#8E8E93]">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-[#8E8E93]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-[#8E8E93]">No cost items found</td></tr>
            )}
            {filtered.map((item, i) => (
              <tr key={item.id} className={`border-b border-[#F2F2F7] last:border-0 hover:bg-[#F9F9FB] transition-colors ${i % 2 === 0 ? '' : 'bg-[#FAFAFA]'}`}>
                <td className="px-4 py-3">
                  <span className="font-mono text-[12px] font-semibold text-[#007AFF] bg-[#E8F4FD] px-2 py-0.5 rounded-md">{item.code}</span>
                </td>
                <td className="px-4 py-3 font-medium text-black max-w-[200px]">
                  <div className="truncate">{item.name}</div>
                  {item.description && <div className="text-[11px] text-[#8E8E93] truncate">{item.description}</div>}
                </td>
                <td className="px-4 py-3 text-[#3C3C43]">{item.category?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {item.contract_types.map(ct => (
                      <span key={ct} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONTRACT_COLORS[ct]}`}>
                        {CONTRACT_LABELS[ct]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#3C3C43]">{item.billing_type ? BILLING_LABELS[item.billing_type] ?? item.billing_type : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {item.markup_eligible && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FFF4E8] text-[#FF9500]">Markup</span>}
                    {item.pass_through && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F0EFFE] text-[#5856D6]">Pass-thru</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {item.countries.length > 0 ? (
                    <span className="text-[12px]">{item.countries.join(', ')}</span>
                  ) : (
                    <span className="text-[11px] text-[#8E8E93]">Global</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.active ? 'bg-[#E8FAF0] text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/dashboard/settings/cost-items/${item.id}`} className="text-[#007AFF] text-[12px] font-semibold hover:underline">Edit</Link>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="text-[#FF3B30] text-[12px] font-semibold hover:underline disabled:opacity-40"
                    >
                      {deletingId === item.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12px] text-[#8E8E93]">{filtered.length} of {items.length} cost items</p>
    </div>
  );
}
