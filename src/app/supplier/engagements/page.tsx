import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Engagement, EngagementStatus } from '@/types/database';

const ENG_STATUS_META: Record<EngagementStatus, { label: string; color: string }> = {
  active:    { label: 'Active',    color: '#34C759' },
  completed: { label: 'Completed', color: '#007AFF' },
  cancelled: { label: 'Cancelled', color: '#FF3B30' },
};

const RATE_TYPE_LABELS: Record<string, string> = {
  daily: 'pro Tag', hourly: 'pro Stunde', monthly: 'pro Monat', fixed: 'Pauschal',
};

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function countBusinessDays(start: string, end: string): number {
  try {
    const s = new Date(start); const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
    let count = 0; const cur = new Date(s);
    while (cur <= e) { const d = cur.getDay(); if (d !== 0 && d !== 6) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  } catch { return 0; }
}

export default async function SupplierEngagementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: supplierData } = await supabase
    .from('suppliers')
    .select('id, company_name')
    .eq('profile_id', user.id)
    .single();

  if (!supplierData) {
    return (
      <div className="px-5 py-8 max-w-2xl mx-auto">
        <h1 className="text-[28px] font-bold tracking-tight text-black mb-4">Engagements</h1>
        <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">Account not linked</p>
          <p className="text-[15px] text-[#8E8E93]">Your account has not been linked to a supplier profile yet.</p>
        </div>
      </div>
    );
  }

  const { data: engData } = await supabase
    .from('engagements')
    .select('*')
    .eq('supplier_id', supplierData.id)
    .order('created_at', { ascending: false });

  const engagements = (engData ?? []) as Engagement[];

  const activeCount = engagements.filter(e => e.status === 'active').length;

  return (
    <div className="px-5 py-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-black leading-tight">Engagements</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">
          {activeCount > 0 ? `${activeCount} active` : 'No active engagements'}
        </p>
      </div>

      {engagements.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" /><rect x="3" y="4" width="18" height="18" rx="2" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold text-black mb-1">No engagements yet</p>
          <p className="text-[14px] text-[#8E8E93]">Engagements appear here when a candidate you submitted is commissioned.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {engagements.map(e => {
            const meta = ENG_STATUS_META[e.status];
            const businessDays = e.start_date && e.end_date ? countBusinessDays(e.start_date, e.end_date) : null;
            const total = e.total_amount ?? (e.rate && businessDays
              ? (e.rate_type === 'daily'   ? e.rate * businessDays
               : e.rate_type === 'hourly'  ? e.rate * businessDays * 8
               : e.rate_type === 'monthly' ? e.rate * (businessDays / 21)
               : e.rate)
              : null);

            return (
              <div key={e.id} className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: meta.color + '18', color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {e.price_locked && (
                      <span className="ml-2 text-[10px] font-semibold text-[#FF9500]">Preis festgelegt</span>
                    )}
                  </div>
                  <span className="text-[12px] text-[#8E8E93] flex-shrink-0">
                    {fmt(e.created_at)}
                  </span>
                </div>

                <h3 className="text-[17px] font-bold text-black leading-tight">{e.candidate_name}</h3>
                {e.candidate_email && (
                  <p className="text-[13px] text-[#8E8E93] mt-0.5">{e.candidate_email}</p>
                )}
                <p className="text-[13px] text-[#007AFF] font-medium mt-1">{e.demand_title}</p>

                <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 pt-3 border-t border-[#F2F2F7]">
                  {(e.start_date || e.end_date) && (
                    <div>
                      <p className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wide mb-0.5">Laufzeit</p>
                      <p className="text-[13px] font-medium text-black">
                        {fmt(e.start_date) ?? '?'}{e.end_date ? ` → ${fmt(e.end_date)}` : ''}
                      </p>
                    </div>
                  )}
                  {e.rate && (
                    <div>
                      <p className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wide mb-0.5">Rate</p>
                      <p className="text-[13px] font-medium text-black">
                        {e.currency} {e.rate.toLocaleString('de-DE')}
                        <span className="text-[11px] text-[#8E8E93] ml-1">{RATE_TYPE_LABELS[e.rate_type] ?? e.rate_type}</span>
                      </p>
                    </div>
                  )}
                  {businessDays && (
                    <div>
                      <p className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wide mb-0.5">Arbeitstage</p>
                      <p className="text-[13px] font-medium text-black">{businessDays}</p>
                    </div>
                  )}
                  {total && (
                    <div>
                      <p className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wide mb-0.5">Gesamtvolumen</p>
                      <p className="text-[14px] font-bold text-black">
                        {e.currency} {Math.round(total).toLocaleString('de-DE')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
