'use client';

import { useState, useRef, useEffect } from 'react';

interface SearchItem {
  label: string;
  sublabel?: string;
  section: string;
  sectionAnchor: string;
  href?: string;
}

interface TenantConfigSearchProps {
  users: { id: string; email: string | null; full_name: string | null; role: string }[];
  suppliers: { id: string; company_name: string; email: string; assigned: boolean }[];
  orgUnits: { id: string; name: string; description: string | null }[];
  jobDescriptions: { id: string; title: string; org_unit_id: string | null }[];
  supplierCategories: { id: string; name: string; assigned: boolean }[];
}

const SECTION_LABELS: Record<string, string> = {
  users: 'Users',
  suppliers: 'Suppliers',
  orgUnits: 'Org Units',
  jobDescriptions: 'Job Descriptions',
  supplierCategories: 'Supplier Categories',
};

export function TenantConfigSearch({
  users, suppliers, orgUnits, jobDescriptions, supplierCategories,
}: TenantConfigSearchProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allItems: SearchItem[] = [
    ...users.map(u => ({
      label: u.full_name || u.email || u.id,
      sublabel: `${u.role} · ${u.email ?? ''}`,
      section: 'users',
      sectionAnchor: '#section-users',
    })),
    ...suppliers.map(s => ({
      label: s.company_name,
      sublabel: `${s.assigned ? 'Assigned' : 'Not assigned'} · ${s.email}`,
      section: 'suppliers',
      sectionAnchor: '#section-suppliers',
    })),
    ...orgUnits.map(o => ({
      label: o.name,
      sublabel: o.description ?? 'Org Unit',
      section: 'orgUnits',
      sectionAnchor: '#section-org',
    })),
    ...jobDescriptions.map(j => ({
      label: j.title,
      sublabel: 'Job Description',
      section: 'jobDescriptions',
      sectionAnchor: '#section-org',
    })),
    ...supplierCategories.map(c => ({
      label: c.name,
      sublabel: `Supplier Category · ${c.assigned ? 'Active for tenant' : 'Not active'}`,
      section: 'supplierCategories',
      sectionAnchor: '#section-suppliers',
    })),
  ];

  const term = q.toLowerCase().trim();
  const results = term.length < 2
    ? []
    : allItems.filter(item =>
        item.label.toLowerCase().includes(term) ||
        (item.sublabel ?? '').toLowerCase().includes(term)
      ).slice(0, 12);

  // Group results by section
  const grouped: Record<string, SearchItem[]> = {};
  for (const r of results) {
    if (!grouped[r.section]) grouped[r.section] = [];
    grouped[r.section].push(r);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleNavigate(anchor: string) {
    setOpen(false);
    setQ('');
    // Smooth scroll to section
    setTimeout(() => {
      const el = document.querySelector(anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  return (
    <div ref={containerRef} className="relative mb-4">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search users, suppliers, org units, JDs, categories…"
          className="w-full h-10 pl-9 pr-8 rounded-xl bg-white text-[13px] text-black placeholder:text-[#C7C7CC] shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[1.5px] border-transparent focus:border-[#007AFF] focus:outline-none transition-colors"
        />
        {q && (
          <button
            onClick={() => { setQ(''); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C7C7CC] flex items-center justify-center text-white hover:bg-[#8E8E93] transition-colors"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {open && term.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#E5E5EA] z-50 overflow-hidden max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-[#8E8E93]">No matches for &ldquo;{q}&rdquo;</p>
          ) : (
            Object.entries(grouped).map(([section, items]) => (
              <div key={section}>
                <div className="px-4 py-2 bg-[#F9F9FB] border-b border-[#F2F2F7]">
                  <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wide">{SECTION_LABELS[section] ?? section}</span>
                </div>
                {items.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleNavigate(item.sectionAnchor)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F2F2F7] transition-colors border-b border-[#F9F9FB] last:border-0 flex items-center gap-3"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white" style={{ backgroundColor: '#007AFF' }}>
                      {item.label[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-black truncate">{item.label}</p>
                      {item.sublabel && <p className="text-[11px] text-[#8E8E93] truncate">{item.sublabel}</p>}
                    </div>
                    <svg className="w-3.5 h-3.5 text-[#C7C7CC] ml-auto flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            ))
          )}
          <div className="px-4 py-2 bg-[#F9F9FB] border-t border-[#F2F2F7]">
            <span className="text-[10px] text-[#8E8E93]">{results.length} result{results.length !== 1 ? 's' : ''} · click to jump to section</span>
          </div>
        </div>
      )}
    </div>
  );
}
