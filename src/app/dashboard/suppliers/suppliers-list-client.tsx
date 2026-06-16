'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { deleteSupplier } from '@/lib/actions/suppliers';
import { DeleteButton } from '@/components/DeleteButton';
import type { Supplier } from '@/types/database';

export function SuppliersListClient({ suppliers, role }: { suppliers: Supplier[]; role: string }) {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return suppliers.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!term) return true;
      const name = s.company_name.toLowerCase();
      const contact = (s.contact_name || '').toLowerCase();
      const email = s.email.toLowerCase();
      const specs = s.specializations.join(' ').toLowerCase();
      return name.includes(term) || contact.includes(term) || email.includes(term) || specs.includes(term);
    });
  }, [suppliers, q, statusFilter]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full h-9 pl-9 pr-8 rounded-xl bg-white text-[13px] text-black placeholder:text-[#C7C7CC] shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-transparent focus:border-[#007AFF] focus:outline-none transition-colors"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C7C7CC] flex items-center justify-center text-white hover:bg-[#8E8E93] transition-colors">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl px-2.5 py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-0.5">Status</span>
          {(['all', 'active', 'inactive'] as const).map(v => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium capitalize transition-colors ${statusFilter === v ? 'bg-[#007AFF] text-white' : 'text-[#3C3C43] hover:bg-[#F2F2F7]'}`}
            >
              {v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[13px] text-[#8E8E93] mb-4">
        {filtered.length} of {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[16px] font-semibold text-black mb-1">No suppliers match</p>
          <p className="text-[14px] text-[#8E8E93]">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          {filtered.map((s, i) => (
            <div key={s.id}>
              {i > 0 && <div className="ml-[68px] h-px bg-[#F2F2F7]" />}
              <div className="flex items-center gap-3 px-4 py-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[15px] font-semibold flex-shrink-0"
                  style={{ backgroundColor: s.status === 'active' ? '#007AFF' : '#8E8E93' }}
                >
                  {s.company_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-semibold text-black truncate">{s.company_name}</p>
                    {s.status === 'inactive' && (
                      <span className="text-[11px] bg-[#8E8E93]/12 text-[#8E8E93] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#8E8E93] truncate">
                    {s.contact_name ? `${s.contact_name} · ` : ''}{s.email}
                  </p>
                  {s.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.specializations.map(spec => (
                        <span key={spec} className="text-[11px] bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-full">{spec}</span>
                      ))}
                    </div>
                  )}
                </div>
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="text-[13px] text-[#007AFF] flex-shrink-0 hidden sm:block">{s.phone}</a>
                )}
                {role === 'admin' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={`/dashboard/suppliers/${s.id}/edit`} className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#007AFF] hover:bg-[#007AFF]/8 transition-colors">
                      Edit
                    </Link>
                    <DeleteButton
                      action={deleteSupplier}
                      id={s.id}
                      confirmMessage={`Delete "${s.company_name}"? This cannot be undone.`}
                      label="Delete"
                      className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors disabled:opacity-40"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
