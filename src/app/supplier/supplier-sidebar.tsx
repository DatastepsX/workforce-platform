'use client';

import { useState } from 'react';
import { DevUserSwitcher } from '@/components/DevUserSwitcher';

interface UserOption {
  id: string;
  email: string;
  role: string;
  displayName: string;
}

interface Props {
  displayName: string;
  initial: string;
  signOut: () => Promise<void>;
  switchToUser: (formData: FormData) => Promise<void>;
  allUsers: UserOption[];
}

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-[#3C3C43] hover:text-black hover:bg-[#F2F2F7] transition-colors"
    >
      {children}
    </a>
  );
}

export function SupplierSidebar({ displayName, initial, signOut, switchToUser, allUsers }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-[#E5E5EA] flex items-center justify-between px-4">
        <span className="text-[17px] font-bold tracking-tight text-black">WorkforceX</span>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -mr-1 text-black">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={close} />}

      {/* Sidebar */}
      <aside className={[
        'fixed inset-y-0 left-0 z-50 w-56 bg-white border-r border-[#E5E5EA] flex flex-col',
        'transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}>
        {/* Brand */}
        <div className="px-5 py-5 border-b border-[#E5E5EA] flex items-center justify-between">
          <div>
            <span className="text-[17px] font-bold tracking-tight text-black">WorkforceX</span>
            <p className="text-[10px] text-[#8E8E93] font-medium tracking-wide mt-0.5">SUPPLIER PORTAL</p>
          </div>
          <button onClick={close} aria-label="Close menu" className="md:hidden p-1 text-[#8E8E93] hover:text-black">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5" onClick={close}>
          <NavItem href="/supplier">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
            </svg>
            Demands
          </NavItem>
          <NavItem href="/supplier/candidates">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4" />
              <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
              <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" />
            </svg>
            Candidates
          </NavItem>
          <NavItem href="/supplier/engagements">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" /><rect x="3" y="4" width="18" height="18" rx="2" />
            </svg>
            Engagements
          </NavItem>
        </nav>

        {/* User area */}
        <div className="border-t border-[#E5E5EA] p-3">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: '#34C759' }}>
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-black truncate leading-tight">{displayName}</p>
              <p className="text-[10px] text-[#8E8E93] leading-tight">Supplier</p>
            </div>
            <DevUserSwitcher switchAction={switchToUser} allUsers={allUsers} />
          </div>
          <form action={signOut} className="mt-1">
            <button type="submit" className="w-full text-left px-3 py-1.5 rounded-lg text-[13px] text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
