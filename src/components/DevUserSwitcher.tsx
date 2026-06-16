'use client';

import { useState } from 'react';

const ROLE_COLORS: Record<string, string> = {
  admin: '#FF3B30',
  hiring_manager: '#FF9500',
  recruiter: '#007AFF',
  supplier: '#34C759',
  candidate: '#8E8E93',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  hiring_manager: 'Hiring Mgr',
  recruiter: 'Recruiter',
  supplier: 'Supplier',
  candidate: 'Candidate',
};

const ROLE_ORDER = ['admin', 'recruiter', 'hiring_manager', 'supplier', 'candidate'];

interface UserOption {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

interface Props {
  switchAction: (formData: FormData) => Promise<void>;
  allUsers: UserOption[];
}

export function DevUserSwitcher({ switchAction, allUsers }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const close = () => { setOpen(false); setSearch(''); };

  const sorted = [...allUsers]
    .filter(u => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return u.displayName.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term);
    })
    .sort((a, b) =>
      (ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)) ||
      a.displayName.localeCompare(b.displayName)
    );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide text-[#8E8E93] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors select-none"
      >
        DEV
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute bottom-8 left-0 z-50 w-56 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.14)] border border-[#E5E5EA] overflow-hidden">
            <div className="px-3 pt-2.5 pb-2 border-b border-[#F2F2F7]">
              <p className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">Switch User</p>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or role…"
                autoFocus
                className="w-full h-7 px-2.5 rounded-lg bg-[#F2F2F7] text-[12px] text-black placeholder:text-[#C7C7CC] outline-none focus:bg-[#E5E5EA] transition-colors"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {sorted.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-[#8E8E93] text-center">No users found</p>
              ) : sorted.map(u => {
                const color = ROLE_COLORS[u.role] ?? '#8E8E93';
                return (
                  <form key={u.id} action={switchAction} onSubmit={close}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="email" value={u.email} />
                    <input type="hidden" name="role" value={u.role} />
                    <button type="submit" className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[#F2F2F7] transition-colors">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-black truncate leading-tight">{u.displayName}</p>
                        <p className="text-[10px] text-[#8E8E93] leading-tight">{ROLE_LABELS[u.role] ?? u.role}</p>
                      </div>
                    </button>
                  </form>
                );
              })}
            </div>
            <div className="border-t border-[#F2F2F7] px-3 py-1.5">
              <p className="text-[10px] text-[#C7C7CC]">Magic link · fallback: Test1234!</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
