import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NavLink } from './nav-link';
import type { Profile } from '@/types/database';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  hiring_manager: 'Hiring Manager',
  recruiter: 'Recruiter',
  candidate: 'Candidate',
  supplier: 'Supplier',
};

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single();

  const role = (profile as Pick<Profile, 'role' | 'full_name' | 'email'> | null)?.role ?? 'candidate';
  const displayName = profile?.full_name || profile?.email || user.email || '';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const canSeeDemands = ['admin', 'hiring_manager', 'recruiter'].includes(role);

  return (
    <div className="min-h-screen flex bg-[#F2F2F7]">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-[#E5E5EA] flex flex-col fixed inset-y-0 left-0 z-20">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-[#E5E5EA]">
          <span className="text-[17px] font-bold tracking-tight text-black">WorkforceX</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
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
              <p className="text-[13px] font-medium text-black truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[11px] text-[#8E8E93] leading-tight">
                {ROLE_LABELS[role]}
              </p>
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

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen">
        {children}
      </main>
    </div>
  );
}
