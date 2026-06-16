'use client';

import { useState } from 'react';

const DEV_USERS = [
  { email: 'micciche.alessandro+admin@gmail.com',     role: 'admin',          label: 'Admin',          color: '#FF3B30' },
  { email: 'micciche.alessandro+hiring@gmail.com',    role: 'hiring_manager', label: 'Hiring Manager', color: '#FF9500' },
  { email: 'micciche.alessandro+recruiter@gmail.com', role: 'recruiter',      label: 'Recruiter',      color: '#007AFF' },
  { email: 'micciche.alessandro+supplier@gmail.com',  role: 'supplier',       label: 'Supplier',       color: '#34C759' },
  { email: 'micciche.alessandro+candidate@gmail.com', role: 'candidate',      label: 'Candidate',      color: '#8E8E93' },
];

interface Props {
  currentRole: string;
  switchAction: (formData: FormData) => Promise<void>;
}

export function DevUserSwitcher({ currentRole, switchAction }: Props) {
  const [open, setOpen] = useState(false);

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
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* popover */}
          <div className="absolute bottom-7 left-0 z-50 w-44 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.14)] border border-[#E5E5EA] overflow-hidden">
            <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider border-b border-[#F2F2F7]">
              Switch User
            </p>
            {DEV_USERS.map(u => {
              const isCurrent = u.role === currentRole;
              return (
                <form key={u.email} action={switchAction} onSubmit={() => setOpen(false)}>
                  <input type="hidden" name="email" value={u.email} />
                  <button
                    type="submit"
                    disabled={isCurrent}
                    className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 hover:bg-[#F2F2F7] disabled:opacity-35 disabled:cursor-default transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: u.color }}
                    />
                    <span className="text-[13px] font-medium text-black flex-1">{u.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] text-[#8E8E93]">you</span>
                    )}
                  </button>
                </form>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
