'use client';

import { useState, useMemo } from 'react';
import type { DemandSupplierStatus, SubmissionStatus } from '@/types/database';

const REL_STATUS_META: Record<DemandSupplierStatus, { label: string; color: string }> = {
  sent:        { label: 'Sent',         color: '#8E8E93' },
  viewed:      { label: 'Viewed',       color: '#FF9500' },
  submitted:   { label: 'Submitted',    color: '#34C759' },
  rejected:    { label: 'Declined',     color: '#FF3B30' },
  preassigned: { label: 'Pre-assigned', color: '#5856D6' },
};

const SUB_STATUS_META: Record<SubmissionStatus, { label: string; color: string }> = {
  proposed:    { label: 'Proposed',    color: '#8E8E93' },
  shortlisted: { label: 'Shortlisted', color: '#007AFF' },
  interview:   { label: 'Interview',   color: '#FF9500' },
  offer:       { label: 'Offer',       color: '#34C759' },
  hired:       { label: 'Hired',       color: '#34C759' },
  awarded:     { label: 'Awarded',     color: '#AF52DE' },
  rejected:    { label: 'Rejected',    color: '#FF3B30' },
};

const STATUS_SORT: Record<DemandSupplierStatus, number> = {
  submitted: 0, viewed: 1, sent: 2, rejected: 3, preassigned: 4,
};

export interface SupplierRow {
  demandSupplierId: string;
  supplierId: string;
  demandId: string;
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  specializations: string[];
  relationStatus: DemandSupplierStatus;
  sentAt: string;
  deadline: string | null;
  candidates: {
    id: string;
    name: string;
    status: SubmissionStatus;
    proposedRate: number | null;
    rateType: string | null;
  }[];
}

function SupplierDrawer({ row, onClose }: { row: SupplierRow; onClose: () => void }) {
  const relMeta = REL_STATUS_META[row.relationStatus];

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] bg-white shadow-[−4px_0_32px_rgba(0,0,0,0.12)] z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#F2F2F7]">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: relMeta.color + '18', color: relMeta.color }}
              >
                {relMeta.label}
              </span>
            </div>
            <h2 className="text-[22px] font-bold text-black leading-tight">{row.companyName}</h2>
            {row.contactName && (
              <p className="text-[14px] text-[#8E8E93] mt-0.5">{row.contactName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#8E8E93] hover:bg-[#E5E5EA] transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Contact */}
          <div className="bg-[#F9F9FB] rounded-2xl px-4 py-1">
            {[
              { label: 'Email', value: <a href={`mailto:${row.email}`} className="text-[#007AFF] hover:underline">{row.email}</a> },
              { label: 'Phone', value: row.phone && <a href={`tel:${row.phone}`} className="text-[#007AFF] hover:underline">{row.phone}</a> },
              { label: 'Sent on', value: new Date(row.sentAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) },
              { label: 'Deadline', value: row.deadline ? new Date(row.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null },
            ].map(({ label, value }) =>
              value ? (
                <div key={label} className="flex items-start gap-3 py-2.5 border-b border-[#F2F2F7] last:border-0">
                  <span className="text-[13px] text-[#8E8E93] min-w-[100px] flex-shrink-0 pt-0.5">{label}</span>
                  <span className="text-[14px] text-black flex-1">{value}</span>
                </div>
              ) : null
            )}
          </div>

          {/* Specializations */}
          {row.specializations.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Specializations</p>
              <div className="flex flex-wrap gap-1.5">
                {row.specializations.map(s => (
                  <span key={s} className="text-[13px] px-3 py-1 rounded-full bg-[#F2F2F7] text-[#3C3C43] font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Submitted candidates */}
          <div>
            <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">
              Submitted Candidates ({row.candidates.length})
            </p>
            {row.candidates.length === 0 ? (
              <div className="bg-[#F9F9FB] rounded-2xl px-4 py-4 text-center">
                <p className="text-[14px] text-[#8E8E93]">No candidates submitted yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {row.candidates.map(c => {
                  const sm = SUB_STATUS_META[c.status];
                  return (
                    <div key={c.id} className="bg-[#F9F9FB] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                      <p className="text-[14px] font-semibold text-black">{c.name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.proposedRate && (
                          <span className="text-[12px] font-semibold text-[#007AFF]">
                            €{c.proposedRate.toLocaleString()}<span className="font-normal text-[#8E8E93] text-[11px]">/{c.rateType ?? 'day'}</span>
                          </span>
                        )}
                        <span
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: sm.color + '18', color: sm.color }}
                        >
                          {sm.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function SuppliersTableClient({ rows }: { rows: SupplierRow[] }) {
  const [selected, setSelected] = useState<SupplierRow | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<DemandSupplierStatus | 'all'>('all');

  const sorted = useMemo(() => {
    const term = q.toLowerCase().trim();
    return [...rows]
      .filter(r => {
        if (statusFilter !== 'all' && r.relationStatus !== statusFilter) return false;
        if (!term) return true;
        return r.companyName.toLowerCase().includes(term) ||
          (r.contactName || '').toLowerCase().includes(term) ||
          r.email.toLowerCase().includes(term);
      })
      .sort((a, b) => STATUS_SORT[a.relationStatus] - STATUS_SORT[b.relationStatus]);
  }, [rows, q, statusFilter]);

  function resetFilters() { setQ(''); setStatusFilter('all'); }
  const isFiltered = q !== '' || statusFilter !== 'all';

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <p className="text-[15px] font-semibold text-black mb-1">No suppliers assigned yet</p>
        <p className="text-[13px] text-[#8E8E93]">Send this demand to suppliers to start receiving candidates.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#F2F2F7]">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search suppliers…"
              className="h-8 pl-8 pr-2 rounded-lg bg-[#F2F2F7] text-[12px] text-black placeholder:text-[#8E8E93] border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white focus:outline-none transition-colors w-40"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#F2F2F7] rounded-lg px-1.5 py-1 ml-auto">
            <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-0.5">Status</span>
            {(['all', 'submitted', 'viewed', 'sent', 'rejected'] as const).map(v => (
              <button key={v} onClick={() => setStatusFilter(v === 'all' ? 'all' : v as DemandSupplierStatus)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors ${statusFilter === v ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
              >
                {v === 'all' ? 'All' : v === 'rejected' ? 'Declined' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-[#F2F2F7]">
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-5 py-3">Supplier</th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[110px]">Status</th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[110px]">Sent</th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[110px]">Deadline</th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[100px]">Candidates</th>
                <th className="px-3 py-3 w-[40px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7]">
              {sorted.length === 0 && isFiltered ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center">
                    <p className="text-[13px] text-[#8E8E93] mb-2">No suppliers match your filter.</p>
                    <button onClick={resetFilters} className="text-[13px] font-medium text-[#007AFF] hover:underline">Clear filters</button>
                  </td>
                </tr>
              ) : null}
              {sorted.map(row => {
                const relMeta = REL_STATUS_META[row.relationStatus];
                const isSelected = selected?.demandSupplierId === row.demandSupplierId;
                const isDeclined = row.relationStatus === 'rejected';
                return (
                  <tr
                    key={row.demandSupplierId}
                    onClick={() => setSelected(isSelected ? null : row)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#007AFF]/5' : isDeclined ? 'opacity-50 hover:bg-[#F9F9FB]' : 'hover:bg-[#F9F9FB]'
                    }`}
                  >
                    <td className="px-5 py-3.5 align-top">
                      <p className="text-[14px] font-semibold text-black">{row.companyName}</p>
                      {row.contactName && (
                        <p className="text-[12px] text-[#8E8E93] mt-0.5">{row.contactName}</p>
                      )}
                      {row.email && (
                        <p className="text-[11px] text-[#C7C7CC] mt-0.5">{row.email}</p>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <span
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: relMeta.color + '18', color: relMeta.color }}
                      >
                        {relMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <span className="text-[13px] text-[#3C3C43]">
                        {new Date(row.sentAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      {row.deadline ? (
                        <span className="text-[13px] text-[#3C3C43]">
                          {new Date(row.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#C7C7CC]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      {row.candidates.length > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[12px] font-bold bg-[#007AFF]/10 text-[#007AFF]">
                          {row.candidates.length}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#C7C7CC]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <svg className="w-3.5 h-3.5 text-[#C7C7CC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-[#F2F2F7] flex items-center justify-between">
          <span className="text-[11px] text-[#C7C7CC]">Click a row to view supplier details and submitted candidates</span>
          <span className="text-[11px] text-[#C7C7CC]">{sorted.length} of {rows.length}</span>
        </div>
      </div>

      {selected && (
        <SupplierDrawer row={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
