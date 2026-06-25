'use client';

import { useState } from 'react';
import { NavLink } from './nav-link';
import { DevUserSwitcher } from '@/components/DevUserSwitcher';
import { NotificationsBell } from '@/components/NotificationsBell';
import type { Notification } from '@/types/database';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  hiring_manager: 'Hiring Manager',
  recruiter: 'Recruiter',
  candidate: 'Candidate',
  supplier: 'Supplier',
  procurement: 'Procurement',
  finance: 'Finance',
};

const isAdmin = (r: string) => r === 'admin' || r === 'super_admin';

interface UserOption {
  id: string;
  email: string;
  role: string;
  displayName: string;
  tenantName: string | null;
  configuredRoleLabel: string | null;
}

interface SidebarProps {
  displayName: string;
  initial: string;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
  canSeeDemands: boolean;
  newDemandsCount: number;
  newSuppliersCount: number;
  newCandidatesCount: number;
  newSubmissionsCount: number;
  newEngagementsCount: number;
  pendingApprovalCount: number;
  pendingReviewCount: number;
  pendingAwardCount: number;
  demandReturnedCount: number;
  notifications: Notification[];
  userId: string;
  signOut: () => Promise<void>;
  switchToUser: (formData: FormData) => Promise<void>;
  allUsers: UserOption[];
}

export function Sidebar({ displayName, initial, role, tenantId, tenantName, canSeeDemands, newDemandsCount, newSuppliersCount, newCandidatesCount, newSubmissionsCount, newEngagementsCount, pendingApprovalCount, pendingReviewCount, pendingAwardCount, demandReturnedCount, notifications, userId, signOut, switchToUser, allUsers }: SidebarProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-white border-b border-[#E5E5EA] flex items-center justify-between px-4 py-2" style={{ minHeight: '52px' }}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-bold tracking-tight text-black leading-tight">WorkforceX</span>
            {role === 'super_admin' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-wide" style={{ backgroundColor: '#FF9500', color: '#fff' }}>SUPER</span>
            )}
          </div>
          <p className="text-[10px] text-[#8E8E93] leading-tight truncate">
            {displayName.split(' ')[0]}{' · '}{ROLE_LABELS[role] ?? role}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -mr-1 text-black flex-shrink-0"
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
        <div className="px-5 py-4 border-b border-[#E5E5EA] flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-bold tracking-tight text-black">WorkforceX</span>
              {role === 'super_admin' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-wide" style={{ backgroundColor: '#FF9500', color: '#fff' }}>SUPER</span>
              )}
            </div>
            {tenantName && role !== 'super_admin' && (
              <div className="flex items-center gap-1 mt-1">
                <svg className="w-3 h-3 text-[#007AFF] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="text-[11px] font-semibold text-[#007AFF] truncate">{tenantName}</span>
              </div>
            )}
            {role === 'super_admin' && (
              <p className="text-[10px] text-[#FF9500] font-semibold mt-0.5">Platform Admin</p>
            )}
          </div>
          {/* Close button visible only on mobile */}
          <button
            onClick={close}
            aria-label="Close menu"
            className="md:hidden p-1 text-[#8E8E93] hover:text-black flex-shrink-0"
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
              <span className="flex-1">Demands</span>
              {pendingReviewCount > 0 && (
                <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#5856D6' }}>
                  {pendingReviewCount > 99 ? '99+' : pendingReviewCount}
                </span>
              )}
              {pendingApprovalCount > 0 && (
                <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#FF9500' }}>
                  {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                </span>
              )}
              {pendingAwardCount > 0 && (
                <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#34C759' }}>
                  {pendingAwardCount > 99 ? '99+' : pendingAwardCount}
                </span>
              )}
              {demandReturnedCount > 0 && (
                <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#FF3B30' }}>
                  {demandReturnedCount > 99 ? '99+' : demandReturnedCount}
                </span>
              )}
              {newDemandsCount > 0 && (
                <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#007AFF' }}>
                  {newDemandsCount > 99 ? '99+' : newDemandsCount}
                </span>
              )}
            </NavLink>
          )}

          {(isAdmin(role) || role === 'recruiter') && (
            <NavLink href="/dashboard/suppliers">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <span className="flex-1">Suppliers</span>
              {newSuppliersCount > 0 && (
                <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#007AFF' }}>
                  {newSuppliersCount > 99 ? '99+' : newSuppliersCount}
                </span>
              )}
            </NavLink>
          )}

          {(isAdmin(role) || role === 'recruiter') && (
            <NavLink href="/dashboard/candidates">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                <path d="M16 3.13a4 4 0 010 7.75" />
                <path d="M21 21v-2a4 4 0 00-3-3.87" />
              </svg>
              <span className="flex-1">Candidates</span>
              {newCandidatesCount > 0 && (
                <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#007AFF' }}>
                  {newCandidatesCount > 99 ? '99+' : newCandidatesCount}
                </span>
              )}
            </NavLink>
          )}

          {(isAdmin(role) || ['recruiter', 'hiring_manager', 'procurement', 'finance'].includes(role)) && (
            <NavLink href="/dashboard/submissions">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <span className="flex-1">Submissions</span>
              {newSubmissionsCount > 0 && (
                <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#007AFF' }}>
                  {newSubmissionsCount > 99 ? '99+' : newSubmissionsCount}
                </span>
              )}
            </NavLink>
          )}

          {(isAdmin(role) || ['recruiter', 'hiring_manager', 'procurement', 'finance'].includes(role)) && (
            <NavLink href="/dashboard/engagements">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" /><rect x="3" y="4" width="18" height="18" rx="2" />
              </svg>
              <span className="flex-1">Awards</span>
              {newEngagementsCount > 0 && (
                <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#007AFF' }}>
                  {newEngagementsCount > 99 ? '99+' : newEngagementsCount}
                </span>
              )}
            </NavLink>
          )}

          {(isAdmin(role) || role === 'recruiter') && (
            <NavLink href="/dashboard/social-media">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
              Social Media
            </NavLink>
          )}

          {role === 'candidate' && (
            <NavLink href="/dashboard/applications">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" />
              </svg>
              My Applications
            </NavLink>
          )}

          {role === 'candidate' && (
            <NavLink href="/dashboard/career-navigator">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Career Navigator
            </NavLink>
          )}

          {role === 'candidate' && (
            <NavLink href="/dashboard/profile">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              My Profile
            </NavLink>
          )}

          {(isAdmin(role) || role === 'recruiter') && (
            <div className="pt-2 mt-2 border-t border-[#F2F2F7]">
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-[#C7C7CC] uppercase tracking-[0.8px]">Settings</p>
              {role === 'super_admin' ? (
                <>
                  <NavLink href="/dashboard/settings/tenants">
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    Clients
                  </NavLink>
                  <NavLink href="/dashboard/settings/supplier-categories">
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6h16M4 12h16M4 18h7" />
                      <circle cx="17" cy="18" r="3" />
                    </svg>
                    Supplier Categories
                  </NavLink>
                </>
              ) : tenantId ? (
                <NavLink href={`/dashboard/settings/tenants/${tenantId}`}>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  Client Config
                </NavLink>
              ) : null}
            </div>
          )}

          <div className="pt-2 mt-2 border-t border-[#F2F2F7]">
            <a
              href="/careers"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/6 transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Career Portal
            </a>
          </div>
        </nav>

        {/* User area */}
        <div className="border-t border-[#E5E5EA] p-3">
          <div className="flex items-center gap-2 px-2 py-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
              style={{ backgroundColor: '#007AFF' }}
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-black truncate leading-tight">{displayName}</p>
              <p className="text-[10px] text-[#8E8E93] leading-tight">{ROLE_LABELS[role] ?? role}</p>
            </div>
            <NotificationsBell initial={notifications} userId={userId} />
            <DevUserSwitcher switchAction={switchToUser} allUsers={allUsers} />
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
