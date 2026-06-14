'use client';

import { useState } from 'react';
import { NavLink } from './nav-link';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  hiring_manager: 'Hiring Manager',
  recruiter: 'Recruiter',
  candidate: 'Candidate',
  supplier: 'Supplier',
};

interface SidebarProps {
  displayName: string;
  initial: string;
  role: string;
  canSeeDemands: boolean;
  signOut: () => Promise<void>;
}

export function Sidebar({ displayName, initial, role, canSeeDemands, signOut }: SidebarProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-[#E5E5EA] flex items-center justify-between px-4">
        <span className="text-[17px] font-bold tracking-tight text-black">WorkforceX</span>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -mr-1 text-black"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* ── Backdrop (mobile only) ───────────────────── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={close}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-56 bg-white border-r border-[#E5E5EA] flex flex-col',
          'transition-transform duration-300 ease-in-out',
          // mobile: slide in/out; desktop: always visible
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-[#E5E5EA] flex items-center justify-between">
          <span className="text-[17px] font-bold tracking-tight text-black">WorkforceX</span>
          {/* Close button visible only on mobile */}
          <button
            onClick={close}
            aria-label="Close menu"
            className="md:hidden p-1 text-[#8E8E93] hover:text-black"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5" onClick={close}>
          <NavLink href="/dashboard">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Overview
          </NavLink>

          {canSeeDemands && (
            <NavLink href="/dashboard/demands">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" />
              </svg>
              Demands
            </NavLink>
          )}

          {canSeeDemands && (
            <NavLink href="/dashboard/suppliers">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              Suppliers
            </NavLink>
          )}
        </nav>

        {/* User area */}
        <div className="border-t border-[#E5E5EA] p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
              style={{ backgroundColor: '#007AFF' }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-black truncate leading-tight">{displayName}</p>
              <p className="text-[11px] text-[#8E8E93] leading-tight">{ROLE_LABELS[role] ?? role}</p>
            </div>
          </div>
          <form action={signOut} className="mt-1">
            <button
              type="submit"
              className="w-full text-left px-3 py-1.5 rounded-lg text-[13px] text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
