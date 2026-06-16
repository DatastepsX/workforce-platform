import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Demand } from '@/types/database';

const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'Permanent', freelance: 'Freelance',
  contractor: 'Contractor', internship: 'Internship',
};

export default async function CareersPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('demands')
    .select('*')
    .eq('status', 'open')
    .contains('channels', ['career_portal'])
    .order('created_at', { ascending: false });

  const demands = (data ?? []) as Demand[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-tight text-black">Open Positions</h1>
        <p className="text-[15px] text-[#8E8E93] mt-1">
          {demands.length} open position{demands.length !== 1 ? 's' : ''} · Apply directly, no agency needed
        </p>
      </div>

      {demands.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">No open positions right now</p>
          <p className="text-[15px] text-[#8E8E93]">Check back soon — new positions are added regularly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {demands.map(demand => (
            <Link
              key={demand.id}
              href={`/careers/${demand.id}`}
              className="block bg-white rounded-2xl px-6 py-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759]">
                      {CONTRACT_LABELS[demand.contract_type] ?? demand.contract_type}
                    </span>
                    {demand.remote_allowed && (
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF]">
                        Remote OK
                      </span>
                    )}
                  </div>
                  <p className="text-[18px] font-semibold text-black group-hover:text-[#007AFF] transition-colors">
                    {demand.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    {demand.location && (
                      <span className="text-[13px] text-[#8E8E93]">📍 {demand.location}</span>
                    )}
                    {demand.start_date && (
                      <span className="text-[13px] text-[#8E8E93]">
                        Start {new Date(demand.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {(demand.budget_min || demand.budget_max) && (
                      <span className="text-[13px] font-semibold text-black">
                        {demand.budget_min && demand.budget_max
                          ? `€${demand.budget_min.toLocaleString()} – €${demand.budget_max.toLocaleString()}`
                          : demand.budget_max
                          ? `Up to €${demand.budget_max.toLocaleString()}`
                          : `From €${demand.budget_min?.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  {demand.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {demand.skills.slice(0, 6).map(s => (
                        <span key={s} className="text-[11px] bg-[#F2F2F7] text-[#3C3C43] px-2.5 py-0.5 rounded-full">
                          {s}
                        </span>
                      ))}
                      {demand.skills.length > 6 && (
                        <span className="text-[11px] text-[#8E8E93]">+{demand.skills.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>
                <svg className="w-5 h-5 text-[#C7C7CC] group-hover:text-[#007AFF] transition-colors flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
