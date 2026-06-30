'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { ComplianceRule } from '@/types/database';

const SEVERITY_META: Record<string, { label: string; cls: string; icon: string }> = {
  info:    { label: 'Info',    cls: 'bg-[#E8F4FD] text-[#007AFF]',     icon: 'ℹ' },
  warning: { label: 'Warning', cls: 'bg-[#FFF4E8] text-[#FF9500]',     icon: '⚠' },
  error:   { label: 'Hard Stop', cls: 'bg-[#FFF0F0] text-[#FF3B30]',  icon: '✗' },
};

const CT_LABELS: Record<string, string> = {
  perm:        'Perm',
  temp:        'Temp',
  contracting: 'Contracting',
  sow:         'SOW',
};

const COUNTRIES = ['DE', 'AT', 'CH', 'GB', 'FR', 'NL', 'BE', 'PL', 'ES', 'IT'];

interface Props {
  rules: ComplianceRule[];
  onDelete: (id: string) => Promise<void>;
}

export function ComplianceRulesClient({ rules, onDelete }: Props) {
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCT, setFilterCT] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterActive, setFilterActive] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = rules.filter(r => {
    if (filterCountry && r.country !== filterCountry) return false;
    if (filterCT && r.contract_type !== filterCT) return false;
    if (filterSeverity && r.severity !== filterSeverity) return false;
    if (filterActive && !r.active) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q) || r.validation_logic.toLowerCase().includes(q);
    }
    return true;
  });

  function handleDelete(id: string) {
    if (!confirm('Delete this compliance rule? This cannot be undone.')) return;
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
          <h1 className="text-[22px] font-bold text-black">Compliance Rules</h1>
          <p className="text-[13px] text-[#8E8E93] mt-0.5">Configurable validation framework for timesheets and expenses</p>
        </div>
        <Link href="/dashboard/settings/compliance-rules/new" className="flex items-center gap-1.5 px-3 py-2 md:px-4 rounded-xl text-white text-[13px] md:text-[14px] font-semibold" style={{ backgroundColor: '#007AFF' }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          <span className="hidden sm:inline">New Rule</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(['info','warning','error'] as const).map(s => {
          const meta = SEVERITY_META[s];
          const count = rules.filter(r => r.severity === s && r.active).length;
          return (
            <div key={s} className={`p-3 rounded-xl border ${s === 'error' ? 'border-[#FF3B30]/20 bg-[#FFF0F0]' : s === 'warning' ? 'border-[#FF9500]/20 bg-[#FFF4E8]' : 'border-[#007AFF]/20 bg-[#E8F4FD]'}`}>
              <div className="text-[22px] font-bold text-black">{count}</div>
              <div className="text-[12px] font-semibold text-[#3C3C43]">{meta.icon} {meta.label}</div>
            </div>
          );
        })}
        <div className="p-3 rounded-xl border border-[#E5E5EA] bg-[#F2F2F7]">
          <div className="text-[22px] font-bold text-black">{rules.filter(r => !r.active).length}</div>
          <div className="text-[12px] font-semibold text-[#8E8E93]">Inactive</div>
        </div>
      </div>

      {/* Filters — stacked on mobile */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rules…"
            className="pl-10 pr-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 w-full sm:w-56" />
        </div>
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="px-3 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] outline-none">
          <option value="">All Countries</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterCT} onChange={e => setFilterCT(e.target.value)} className="px-3 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] outline-none">
          <option value="">All Contract Types</option>
          <option value="perm">Perm</option>
          <option value="temp">Temp</option>
          <option value="contracting">Contracting</option>
          <option value="sow">SOW</option>
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="px-3 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] outline-none">
          <option value="">All Severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Hard Stop</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] cursor-pointer">
          <input type="checkbox" className="accent-[#007AFF]" checked={filterActive} onChange={e => setFilterActive(e.target.checked)} />
          Active only
        </label>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <p className="text-center py-10 text-[#8E8E93] text-[14px]">No compliance rules found</p>
        )}
        {filtered.map(rule => {
          const meta = SEVERITY_META[rule.severity];
          return (
            <div key={rule.id} className="bg-white border border-[#E5E5EA] rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.icon} {meta.label}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${rule.active ? 'bg-[#E8FAF0] text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                    {rule.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/dashboard/settings/compliance-rules/${rule.id}`} className="text-[#007AFF] text-[12px] font-semibold hover:underline">Edit</Link>
                  <button onClick={() => handleDelete(rule.id)} disabled={deletingId === rule.id}
                    className="text-[#FF3B30] text-[12px] font-semibold hover:underline disabled:opacity-40">
                    {deletingId === rule.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
              <p className="text-[14px] font-semibold text-black">{rule.name}</p>
              {rule.description && <p className="text-[12px] text-[#8E8E93] mt-0.5 line-clamp-2">{rule.description}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {rule.country ? (
                  <span className="text-[11px] font-semibold bg-[#F2F2F7] px-2 py-0.5 rounded">{rule.country}</span>
                ) : <span className="text-[11px] text-[#8E8E93]">Global</span>}
                {rule.contract_type ? (
                  <span className="text-[11px] font-semibold text-[#5856D6] bg-[#F0EFFE] px-2 py-0.5 rounded-full">{CT_LABELS[rule.contract_type] ?? rule.contract_type}</span>
                ) : <span className="text-[11px] text-[#8E8E93]">All Types</span>}
                {rule.threshold != null && (
                  <span className="font-mono text-[11px] font-semibold text-black">{rule.threshold} {rule.threshold_unit}</span>
                )}
                <span className="font-mono text-[10px] bg-[#F2F2F7] px-1.5 py-0.5 rounded text-[#3C3C43]">{rule.validation_logic}</span>
              </div>
              <p className="mt-1.5 text-[11px]">
                {rule.override_allowed
                  ? <span className="text-[#34C759] font-semibold">✓ Override allowed</span>
                  : <span className="text-[#FF3B30] font-semibold">✗ Hard stop</span>}
              </p>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#F2F2F7] bg-[#F9F9FB]">
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Severity</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Rule Name</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Country</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Contract Type</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Threshold</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Logic</th>
              <th className="text-left px-4 py-3 font-semibold text-[#8E8E93]">Override</th>
              <th className="text-right px-4 py-3 font-semibold text-[#8E8E93]">Status</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-[#8E8E93]">No compliance rules found</td></tr>
            )}
            {filtered.map(rule => {
              const meta = SEVERITY_META[rule.severity];
              return (
                <tr key={rule.id} className="border-b border-[#F2F2F7] last:border-0 hover:bg-[#F9F9FB] transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.icon} {meta.label}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="font-medium text-black truncate">{rule.name}</div>
                    {rule.description && <div className="text-[11px] text-[#8E8E93] truncate">{rule.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {rule.country ? (
                      <span className="text-[12px] font-semibold bg-[#F2F2F7] px-2 py-0.5 rounded">{rule.country}</span>
                    ) : (
                      <span className="text-[11px] text-[#8E8E93]">Global</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {rule.contract_type ? (
                      <span className="text-[12px] font-semibold text-[#5856D6] bg-[#F0EFFE] px-2 py-0.5 rounded-full">{CT_LABELS[rule.contract_type] ?? rule.contract_type}</span>
                    ) : (
                      <span className="text-[11px] text-[#8E8E93]">All Types</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {rule.threshold !== null ? (
                      <span className="font-mono text-[12px] font-semibold text-black">{rule.threshold} <span className="text-[#8E8E93] font-normal">{rule.threshold_unit}</span></span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] bg-[#F2F2F7] px-2 py-0.5 rounded text-[#3C3C43]">{rule.validation_logic}</span>
                  </td>
                  <td className="px-4 py-3">
                    {rule.override_allowed ? (
                      <span className="text-[11px] text-[#34C759] font-semibold">✓ Allowed</span>
                    ) : (
                      <span className="text-[11px] text-[#FF3B30] font-semibold">✗ Hard stop</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${rule.active ? 'bg-[#E8FAF0] text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/settings/compliance-rules/${rule.id}`} className="text-[#007AFF] text-[12px] font-semibold hover:underline">Edit</Link>
                      <button onClick={() => handleDelete(rule.id)} disabled={deletingId === rule.id} className="text-[#FF3B30] text-[12px] font-semibold hover:underline disabled:opacity-40">
                        {deletingId === rule.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12px] text-[#8E8E93]">{filtered.length} of {rules.length} rules</p>
    </div>
  );
}
