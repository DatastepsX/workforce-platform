import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Profile, Demand } from '@/types/database';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'You have full access to all platform features.',
  hiring_manager: 'Create and track your open positions.',
  recruiter: 'Manage all demands and candidates.',
  candidate: 'Browse open positions and manage your applications.',
  supplier: 'View demand requests and submit candidate profiles.',
};

interface StatCardProps {
  label: string;
  value: number | string;
  href?: string;
  accent?: string;
}

function StatCard({ label, value, href, accent = '#007AFF' }: StatCardProps) {
  const content = (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <p className="text-[13px] font-medium text-[#8E8E93] mb-1">{label}</p>
      <p className="text-[34px] font-bold tracking-tight" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const p = profile as Profile | null;
  const role = p?.role ?? 'candidate';
  const displayName = p?.full_name || p?.email || user.email || '';

  // Fetch demand stats for relevant roles
  let demandStats: { open: number; draft: number; total: number } | null = null;
  if (['admin', 'hiring_manager', 'recruiter'].includes(role)) {
    const { data: demands } = await supabase
      .from('demands')
      .select('status');
    if (demands) {
      const d = demands as Pick<Demand, 'status'>[];
      demandStats = {
        total: d.length,
        open: d.filter(x => x.status === 'open').length,
        draft: d.filter(x => x.status === 'draft').length,
      };
    }
  }

  return (
    <div className="px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[13px] font-medium text-[#8E8E93] mb-1">{getGreeting()}</p>
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight mb-2">
          {displayName ? `Welcome, ${displayName.split(' ')[0]}` : 'Welcome'}
        </h1>
        <p className="text-[15px] text-[#8E8E93]">{ROLE_DESCRIPTIONS[role]}</p>
      </div>

      {/* Stats */}
      {demandStats !== null && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Demands" value={demandStats.total} href="/dashboard/demands" />
          <StatCard label="Open" value={demandStats.open} href="/dashboard/demands?status=open" accent="#34C759" />
          <StatCard label="Draft" value={demandStats.draft} href="/dashboard/demands?status=draft" accent="#8E8E93" />
        </div>
      )}

      {/* Quick actions */}
      {['admin', 'hiring_manager', 'recruiter'].includes(role) && (
        <div>
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2 ml-1">
            Quick Actions
          </p>
          <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <Link
              href="/dashboard/demands/new"
              className="flex items-center justify-between px-4 py-4 hover:bg-[#F2F2F7] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,122,255,0.12)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth={2} strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <span className="text-[16px] text-black font-medium">Create new demand</span>
              </div>
              <svg className="w-4 h-4 text-[#C6C6C8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
            <div className="ml-[58px] h-px bg-[#C6C6C8]" />
            <Link
              href="/dashboard/demands"
              className="flex items-center justify-between px-4 py-4 hover:bg-[#F2F2F7] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,122,255,0.12)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <path d="M9 12h6M9 16h4" />
                  </svg>
                </div>
                <span className="text-[16px] text-black font-medium">View all demands</span>
              </div>
              <svg className="w-4 h-4 text-[#C6C6C8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Candidate CTA */}
      {role === 'candidate' && (
        <div className="bg-white rounded-2xl p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">Complete your profile</p>
          <p className="text-[15px] text-[#8E8E93] mb-4">Add your details to start applying to open positions.</p>
          <button
            className="px-5 py-2.5 rounded-[10px] text-white text-[15px] font-semibold"
            style={{ backgroundColor: '#007AFF' }}
          >
            Edit profile
          </button>
        </div>
      )}
    </div>
  );
}
