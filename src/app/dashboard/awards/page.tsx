import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Award, AwardStatus, UserRole } from '@/types/database';

const STATUS_META: Record<AwardStatus, { label: string; color: string }> = {
  pending_approval: { label: 'Pending Approval', color: '#FF9500' },
  approved:         { label: 'Approved',          color: '#007AFF' },
  active:           { label: 'Active',            color: '#34C759' },
  completed:        { label: 'Completed',         color: '#8E8E93' },
  cancelled:        { label: 'Cancelled',         color: '#FF3B30' },
};

const STATUS_FILTERS: { value: AwardStatus | 'all'; label: string }[] = [
  { value: 'all',              label: 'All' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved',         label: 'Approved' },
  { value: 'active',           label: 'Active' },
  { value: 'completed',        label: 'Completed' },
  { value: 'cancelled',        label: 'Cancelled' },
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AwardsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile?.role ?? 'candidate') as UserRole;
  if (!['super_admin', 'admin', 'recruiter', 'hiring_manager', 'procurement', 'finance'].includes(role)) {
    redirect('/dashboard');
  }

  const { status: statusFilter } = await searchParams;

  // Fetch all awards for stats + filtered for list
  const { data: allData } = await supabase.from('awards').select('id, status').order('created_at', { ascending: false });
  const allAwardsForStats = (allData ?? []) as { id: string; status: AwardStatus }[];

  let q = supabase.from('awards').select('*').order('created_at', { ascending: false });
  if (statusFilter && statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  }
  const { data } = await q;
  const awards = (data ?? []) as Award[];

  const statCounts: Record<AwardStatus, number> = {
    pending_approval: allAwardsForStats.filter(a => a.status === 'pending_approval').length,
    approved:         allAwardsForStats.filter(a => a.status === 'approved').length,
    active:           allAwardsForStats.filter(a => a.status === 'active').length,
    completed:        allAwardsForStats.filter(a => a.status === 'completed').length,
    cancelled:        allAwardsForStats.filter(a => a.status === 'cancelled').length,
  };

  function fmtDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const canAct = ['super_admin', 'admin', 'recruiter'].includes(role);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-4xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[26px] sm:text-[28px] font-bold text-black tracking-tight">Awards</h1>
          <p className="text-[13px] sm:text-[14px] text-[#8E8E93] mt-1">
            Formal candidate awards with their own approval workflow
          </p>
        </div>
      </div>

      {/* Stats bar — mobile optimized (2+3 grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-5">
        {([
          { value: 'pending_approval', label: 'Pending', color: '#FF9500', bg: '#FFF4E8' },
          { value: 'approved',         label: 'Approved', color: '#007AFF', bg: '#E8F4FD' },
          { value: 'active',           label: 'Active',   color: '#34C759', bg: '#E8FAF0' },
          { value: 'completed',        label: 'Completed', color: '#8E8E93', bg: '#F2F2F7' },
          { value: 'cancelled',        label: 'Cancelled', color: '#FF3B30', bg: '#FFECEC' },
        ] as { value: AwardStatus; label: string; color: string; bg: string }[]).map(s => {
          const count = statCounts[s.value] ?? 0;
          const isActive = (statusFilter ?? '') === s.value;
          return (
            <Link key={s.value} href={isActive ? '/dashboard/awards' : `/dashboard/awards?status=${s.value}`}
              className={`rounded-2xl p-3 sm:p-4 border transition-all ${isActive ? 'border-2' : 'border'}`}
              style={{ borderColor: isActive ? s.color : '#E5E5EA', backgroundColor: isActive ? s.bg : 'white' }}>
              <div className="text-[22px] sm:text-[26px] font-bold" style={{ color: count > 0 ? 'black' : '#C7C7CC' }}>{count}</div>
              <div className="text-[11px] sm:text-[12px] font-semibold mt-0.5" style={{ color: s.color }}>{s.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 bg-white rounded-xl px-2 py-1.5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-5 w-fit overflow-x-auto">
        {STATUS_FILTERS.map(f => (
          <Link
            key={f.value}
            href={f.value === 'all' ? '/dashboard/awards' : `/dashboard/awards?status=${f.value}`}
            className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap ${
              (statusFilter ?? 'all') === f.value
                ? 'bg-[#007AFF] text-white'
                : 'text-[#8E8E93] hover:text-black'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {awards.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-black mb-1">No awards yet</p>
          <p className="text-[13px] text-[#8E8E93]">
            Awards are created when a candidate is selected during the screening stage of a demand.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {awards.map(award => {
            const meta = STATUS_META[award.status] ?? STATUS_META.pending_approval;
            return (
              <Link key={award.id} href={`/dashboard/awards/${award.id}`}>
                <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_16px_rgba(0,0,0,0.1)] transition-shadow flex items-center gap-4 group">
                  {/* Status indicator */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: meta.color + '18', color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {canAct && award.status === 'pending_approval' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FF9500]/10 text-[#FF9500]">
                          Action required
                        </span>
                      )}
                    </div>
                    <p className="text-[16px] font-bold text-black leading-snug">{award.candidate_name}</p>
                    <p className="text-[13px] text-[#8E8E93] mt-0.5">
                      {award.demand_title}
                      {award.supplier_name ? ` · via ${award.supplier_name}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {award.rate ? (
                      <p className="text-[15px] font-bold text-black">
                        {award.currency} {award.rate.toLocaleString()}
                        <span className="text-[12px] font-normal text-[#8E8E93] ml-1">/{award.rate_type}</span>
                      </p>
                    ) : null}
                    {award.total_amount ? (
                      <p className="text-[12px] text-[#8E8E93]">
                        Total {award.currency} {award.total_amount.toLocaleString()}
                      </p>
                    ) : null}
                    {(award.start_date || award.end_date) && (
                      <p className="text-[11px] text-[#C7C7CC] mt-0.5">
                        {fmtDate(award.start_date) ?? '?'}{award.end_date ? ` – ${fmtDate(award.end_date)}` : ''}
                      </p>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-[#C7C7CC] group-hover:text-[#007AFF] transition-colors flex-shrink-0"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-[12px] text-[#C7C7CC] mt-6 px-1">
        {awards.length} {statusFilter && statusFilter !== 'all' ? `${statusFilter.replace('_', ' ')} ` : ''}award{awards.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
