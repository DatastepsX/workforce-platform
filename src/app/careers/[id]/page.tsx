import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Demand, DemandStatus } from '@/types/database';

const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'Permanent', freelance: 'Freelance',
  contractor: 'Contractor', internship: 'Internship',
};

const INACTIVE_REASONS: Record<DemandStatus, string> = {
  draft:      'This position is not yet published.',
  open:       '',
  in_progress: 'This position is currently being filled.',
  on_hold:    'This position is currently on hold.',
  closed:     'This position has been filled.',
  cancelled:  'This position has been cancelled.',
};

export default async function CareerDemandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('demands')
    .select('*')
    .eq('id', id)
    .single();

  if (!data) notFound();
  const demand = data as Demand;
  const isActive = demand.status === 'open';

  if (!isActive) {
    return (
      <div className="max-w-lg mx-auto">
        <Link href="/careers" className="inline-flex items-center gap-1 text-[14px] text-[#007AFF] mb-6 hover:opacity-70 transition-opacity">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          All positions
        </Link>
        <div className="bg-white rounded-2xl p-10 shadow-[0_1px_8px_rgba(0,0,0,0.06)] text-center">
          <div className="w-16 h-16 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-[22px] font-bold text-black mb-2">{demand.title}</h1>
          <p className="text-[15px] text-[#8E8E93] mb-1">
            {INACTIVE_REASONS[demand.status]}
          </p>
          <p className="text-[14px] text-[#8E8E93] mb-8">
            This position is no longer accepting applications.
          </p>
          {demand.location && (
            <p className="text-[13px] text-[#C7C7CC] mb-6">
              {CONTRACT_LABELS[demand.contract_type] ?? demand.contract_type}{demand.location ? ` · ${demand.location}` : ''}
            </p>
          )}
          <Link
            href="/careers"
            className="inline-block px-6 py-3 rounded-2xl text-white text-[15px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#007AFF' }}
          >
            Browse open positions →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link href="/careers" className="inline-flex items-center gap-1 text-[14px] text-[#007AFF] mb-6 hover:opacity-70 transition-opacity">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        All positions
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#34C759]/10 text-[#34C759]">
            {CONTRACT_LABELS[demand.contract_type] ?? demand.contract_type}
          </span>
          {demand.remote_allowed && (
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#007AFF]/10 text-[#007AFF]">Remote OK</span>
          )}
        </div>
        <h1 className="text-[32px] font-bold tracking-tight text-black leading-tight">{demand.title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[14px] text-[#8E8E93]">
          {demand.location && <span>📍 {demand.location}</span>}
          {demand.start_date && <span>Start {new Date(demand.start_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>}
          {demand.experience_years && <span>{demand.experience_years}+ years experience</span>}
        </div>
      </div>

      {(demand.budget_min || demand.budget_max) && (
        <div className="bg-white rounded-2xl px-5 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#34C759]/10 flex items-center justify-center text-[16px]">€</div>
          <div>
            <p className="text-[12px] text-[#8E8E93]">Compensation</p>
            <p className="text-[16px] font-semibold text-black">
              {demand.budget_min && demand.budget_max
                ? `€${demand.budget_min.toLocaleString()} – €${demand.budget_max.toLocaleString()}`
                : demand.budget_max ? `Up to €${demand.budget_max.toLocaleString()}`
                : `From €${demand.budget_min?.toLocaleString()}`}
            </p>
          </div>
        </div>
      )}

      {demand.description && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-3">About this role</p>
          <p className="text-[15px] text-black leading-relaxed whitespace-pre-wrap">{demand.description}</p>
        </div>
      )}

      {demand.skills.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-6">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-3">Required Skills</p>
          <div className="flex flex-wrap gap-2">
            {demand.skills.map(s => (
              <span key={s} className="text-[13px] bg-[#007AFF]/10 text-[#007AFF] px-3 py-1 rounded-full font-medium">{s}</span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)] text-center">
        <p className="text-[17px] font-semibold text-black mb-1">Interested in this role?</p>
        <p className="text-[14px] text-[#8E8E93] mb-4">Apply directly — no agency, no middleman.</p>
        <Link
          href={`/careers/${id}/apply`}
          className="inline-block px-8 py-3.5 rounded-2xl text-white text-[16px] font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#007AFF', boxShadow: '0 4px 16px rgba(0,122,255,0.3)' }}
        >
          Apply Now
        </Link>
      </div>
    </div>
  );
}
