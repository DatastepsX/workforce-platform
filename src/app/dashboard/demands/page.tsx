import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { FilterBar } from './filter-bar';
import type { Demand, DemandStatus, DemandPriority } from '@/types/database';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/workflow';

const PRIORITY_LABELS: Record<DemandPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_COLORS: Record<DemandPriority, string> = {
  low: '#8E8E93',
  medium: '#007AFF',
  high: '#FF9500',
  urgent: '#FF3B30',
};

const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'Permanent',
  freelance: 'Freelance',
  contractor: 'Contractor',
  internship: 'Internship',
};

interface PageProps {
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>;
}

export default async function DemandsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { status, priority, q } = await searchParams;

  let query = supabase
    .from('demands')
    .select('*')
    .order('updated_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status as DemandStatus);
  if (priority && priority !== 'all') query = query.eq('priority', priority as DemandPriority);
  if (q?.trim()) query = query.ilike('title', `%${q.trim()}%`);

  const [{ data: demands }, { data: unreadNotifs }] = await Promise.all([
    query,
    supabase
      .from('notifications')
      .select('related_id')
      .eq('user_id', user.id)
      .eq('type', 'demand_created')
      .is('read_at', null),
  ]);
  const list = (demands ?? []) as Demand[];
  const unreadIds = new Set((unreadNotifs ?? []).map(n => n.related_id as string));

  return (
    <div className="px-4 sm:px-8 pt-20 sm:pt-10 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-black leading-tight">Demands</h1>
          <p className="text-[14px] sm:text-[15px] text-[#8E8E93] mt-0.5">{list.length} result{list.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/dashboard/demands/new"
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[12px] text-white text-[14px] sm:text-[15px] font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.28)' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="hidden sm:inline">New Demand</span>
        </Link>
      </div>

      {/* Filters */}
      <Suspense>
        <FilterBar />
      </Suspense>

      {/* List */}
      {list.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">No demands found</p>
          <p className="text-[15px] text-[#8E8E93]">Try changing filters or create a new demand.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(demand => {
            const isUnread = unreadIds.has(demand.id);
            return (
            <Link
              key={demand.id}
              href={`/dashboard/demands/${demand.id}`}
              className={`block bg-white rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-shadow ${isUnread ? 'border-l-[3px] border-[#007AFF]' : ''}`}
            >
              {/* Top row: badges + budget */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {isUnread && <span className="w-2 h-2 rounded-full bg-[#007AFF] flex-shrink-0" />}
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[demand.status] + '18', color: STATUS_COLORS[demand.status] }}
                    >
                      {STATUS_LABELS[demand.status]}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: PRIORITY_COLORS[demand.priority] + '18', color: PRIORITY_COLORS[demand.priority] }}
                    >
                      {PRIORITY_LABELS[demand.priority]}
                    </span>
                    <span className="text-[11px] text-[#8E8E93]">{CONTRACT_LABELS[demand.contract_type]}</span>
                  </div>
                  <p className="text-[15px] sm:text-[16px] font-semibold text-black">{demand.title}</p>
                  {demand.location && (
                    <p className="text-[12px] sm:text-[13px] text-[#8E8E93] mt-0.5">
                      {demand.location}{demand.remote_allowed ? ' · Remote OK' : ''}
                    </p>
                  )}
                </div>
                {/* Right column: budget + dates — desktop only */}
                <div className="hidden sm:block text-right flex-shrink-0 min-w-[90px]">
                  {(demand.budget_min || demand.budget_max) && (
                    <p className="text-[13px] font-semibold text-black">
                      {demand.budget_min && demand.budget_max
                        ? `€${demand.budget_min.toLocaleString()}–${demand.budget_max.toLocaleString()}`
                        : demand.budget_max
                        ? `up to €${demand.budget_max.toLocaleString()}`
                        : `from €${demand.budget_min?.toLocaleString()}`}
                    </p>
                  )}
                  <p className="text-[11px] text-[#8E8E93] mt-0.5">
                    Updated {new Date(demand.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-[#C7C7CC]">
                    Created {new Date(demand.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <svg className="w-4 h-4 text-[#C6C6C8] flex-shrink-0 mt-1 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>

              {/* Skills + mobile meta row */}
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {demand.skills.slice(0, 5).map(skill => (
                    <span key={skill} className="text-[10px] sm:text-[11px] bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-full">
                      {skill}
                    </span>
                  ))}
                  {demand.skills.length > 5 && (
                    <span className="text-[10px] sm:text-[11px] text-[#8E8E93]">+{demand.skills.length - 5}</span>
                  )}
                </div>
                {/* Mobile-only budget + date */}
                {(demand.budget_min || demand.budget_max) && (
                  <p className="sm:hidden text-[11px] font-semibold text-black flex-shrink-0">
                    {demand.budget_max ? `€${demand.budget_max.toLocaleString()}` : `€${demand.budget_min?.toLocaleString()}`}
                  </p>
                )}
              </div>
            </Link>
          );})}
        </div>
      )}
    </div>
  );
}
