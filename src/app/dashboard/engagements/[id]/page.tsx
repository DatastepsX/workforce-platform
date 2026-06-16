import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { updateEngagementStatus } from '@/lib/actions/engagements';
import type { Engagement, EngagementStatus } from '@/types/database';

const STATUS_META: Record<EngagementStatus, { label: string; color: string }> = {
  active:    { label: 'Active',    color: '#34C759' },
  completed: { label: 'Completed', color: '#007AFF' },
  cancelled: { label: 'Cancelled', color: '#FF3B30' },
};

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F2F2F7] last:border-0">
      <span className="text-[14px] text-[#8E8E93] font-medium min-w-[140px] flex-shrink-0">{label}</span>
      <span className="text-[14px] text-black text-right flex-1">{value}</span>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EngagementDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter', 'hiring_manager'].includes(profile?.role ?? '')) redirect('/dashboard');

  const { data } = await supabase.from('engagements').select('*').eq('id', id).single();
  if (!data) notFound();
  const eng = data as Engagement;

  const meta = STATUS_META[eng.status];

  const duration = eng.start_date && eng.end_date
    ? Math.round((new Date(eng.end_date).getTime() - new Date(eng.start_date).getTime()) / 86400000)
    : null;

  return (
    <div className="px-8 py-10 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/engagements" className="hover:text-[#007AFF] transition-colors">Engagements</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-black font-medium truncate">{eng.candidate_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: meta.color + '18', color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-black leading-tight">{eng.candidate_name}</h1>
          <p className="text-[15px] text-[#8E8E93] mt-1">{eng.demand_title}</p>
        </div>
        {eng.rate && (
          <div className="text-right flex-shrink-0">
            <p className="text-[28px] font-bold text-black">{eng.currency} {eng.rate.toLocaleString()}</p>
            <p className="text-[13px] text-[#8E8E93]">per {eng.rate_type}</p>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Details</p>
        <Row label="Demand" value={
          <Link href={`/dashboard/demands/${eng.demand_id}`} className="text-[#007AFF] hover:underline">
            {eng.demand_title}
          </Link>
        } />
        <Row label="Candidate" value={eng.candidate_name} />
        {eng.candidate_email && (
          <Row label="Contact" value={
            <a href={`mailto:${eng.candidate_email}`} className="text-[#007AFF] hover:underline">
              {eng.candidate_email}
            </a>
          } />
        )}
        <Row label="Supplier" value={eng.supplier_name ?? null} />
        <Row label="Start Date" value={fmt(eng.start_date)} />
        <Row label="End Date" value={fmt(eng.end_date)} />
        {duration != null && duration > 0 && (
          <Row label="Duration" value={`${duration} days`} />
        )}
        <Row label="Created" value={
          new Date(eng.created_at).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
          })
        } />
      </div>

      {/* Notes */}
      {eng.notes && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Notes</p>
          <p className="text-[15px] text-black leading-relaxed whitespace-pre-wrap">{eng.notes}</p>
        </div>
      )}

      {/* Status actions */}
      {eng.status === 'active' && (
        <div className="flex gap-3 mt-2">
          <form action={updateEngagementStatus.bind(null, id, 'completed')}>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#007AFF', boxShadow: '0 2px 8px rgba(0,122,255,0.3)' }}
            >
              Mark as Completed
            </button>
          </form>
          <form action={updateEngagementStatus.bind(null, id, 'cancelled')}>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-[#FF3B30] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
      {eng.status === 'cancelled' && (
        <form action={updateEngagementStatus.bind(null, id, 'active')}>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold"
            style={{ backgroundColor: '#34C759' }}
          >
            Reactivate
          </button>
        </form>
      )}
    </div>
  );
}
