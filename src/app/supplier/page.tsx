import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { updateDemandSupplierStatus } from '@/lib/actions/suppliers';
import { DemandsReadMarker } from './demands-read-marker';
import type { Demand, DemandSupplier, DemandSupplierStatus, Engagement, EngagementStatus } from '@/types/database';

const STATUS_COLORS: Record<DemandSupplierStatus, string> = {
  sent: '#007AFF',
  viewed: '#FF9500',
  submitted: '#34C759',
  rejected: '#FF3B30',
  preassigned: '#5856D6',
};

const STATUS_LABELS: Record<DemandSupplierStatus, string> = {
  sent: 'New',
  viewed: 'Viewed',
  submitted: 'Submitted',
  rejected: 'Rejected',
  preassigned: 'Pending',
};

const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'Permanent',
  freelance: 'Freelance',
  contractor: 'Contractor',
  internship: 'Internship',
};

interface SubmissionEntry {
  id: string;
  candidateName: string;
  status: string;
  proposedRate: number | null;
  rateType: string | null;
  submittedAt: string;
  headline: string | null;
}

interface DemandEntry extends DemandSupplier {
  demand: Demand;
  submissions: SubmissionEntry[];
}

export default async function SupplierPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get this user's supplier record
  const { data: supplierData } = await supabase
    .from('suppliers')
    .select('id, company_name')
    .eq('profile_id', user.id)
    .single();

  // Fetch assigned demands
  let entries: DemandEntry[] = [];
  if (supplierData) {
    const admin = createAdminClient();
    const { data: dsData } = await supabase
      .from('demand_suppliers')
      .select('*')
      .eq('supplier_id', supplierData.id)
      .order('sent_at', { ascending: false });

    if (dsData && dsData.length > 0) {
      const demandIds = (dsData as DemandSupplier[]).map(d => d.demand_id);
      const [{ data: demandsData }, { data: subsData }] = await Promise.all([
        supabase.from('demands').select('*').in('id', demandIds),
        admin.from('candidate_submissions')
          .select('id, demand_id, candidate_name, status, proposed_rate, rate_type, submitted_at, supplier_candidates(headline)')
          .eq('supplier_id', supplierData.id)
          .in('demand_id', demandIds)
          .order('submitted_at', { ascending: false }),
      ]);

      const demandsMap = Object.fromEntries(
        ((demandsData ?? []) as Demand[]).map(d => [d.id, d])
      );

      const subsByDemand: Record<string, SubmissionEntry[]> = {};
      for (const sub of (subsData ?? []) as unknown as Array<{
        id: string; demand_id: string; candidate_name: string; status: string;
        proposed_rate: number | null; rate_type: string | null; submitted_at: string;
        supplier_candidates: { headline: string | null } | null;
      }>) {
        if (!subsByDemand[sub.demand_id]) subsByDemand[sub.demand_id] = [];
        subsByDemand[sub.demand_id].push({
          id: sub.id,
          candidateName: sub.candidate_name,
          status: sub.status,
          proposedRate: sub.proposed_rate,
          rateType: sub.rate_type,
          submittedAt: sub.submitted_at,
          headline: sub.supplier_candidates?.headline ?? null,
        });
      }

      entries = (dsData as DemandSupplier[])
        .map(ds => ({ ...ds, demand: demandsMap[ds.demand_id], submissions: subsByDemand[ds.demand_id] ?? [] }))
        .filter(e => e.demand);

      // Auto-mark 'sent' as 'viewed' for entries loaded now
      const toMarkViewed = entries
        .filter(e => e.status === 'sent')
        .map(e => e.id);

      if (toMarkViewed.length > 0) {
        await supabase
          .from('demand_suppliers')
          .update({ status: 'viewed' })
          .in('id', toMarkViewed);

        entries = entries.map(e =>
          toMarkViewed.includes(e.id) ? { ...e, status: 'viewed' as DemandSupplierStatus } : e
        );
      }
    }
  }

  const newCount = entries.filter(e => e.status === 'viewed' || e.status === 'sent').length;

  // Fetch engagements for this supplier
  let engagements: Engagement[] = [];
  if (supplierData) {
    const { data: engData } = await supabase
      .from('engagements')
      .select('*')
      .eq('supplier_id', supplierData.id)
      .order('created_at', { ascending: false });
    engagements = (engData ?? []) as Engagement[];
  }

  const ENG_STATUS_META: Record<EngagementStatus, { label: string; color: string }> = {
    active:    { label: 'Active',    color: '#34C759' },
    completed: { label: 'Completed', color: '#007AFF' },
    cancelled: { label: 'Cancelled', color: '#FF3B30' },
  };

  function fmtDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <div className="px-5 py-8 max-w-2xl mx-auto">
      <DemandsReadMarker />
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-black leading-tight">
          {supplierData?.company_name ?? 'Supplier Portal'}
        </h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">
          {newCount > 0 ? `${newCount} new requirement${newCount !== 1 ? 's' : ''}` : 'No new requirements'}
        </p>
      </div>

      {!supplierData ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">Account not linked</p>
          <p className="text-[15px] text-[#8E8E93]">
            Your account has not been linked to a supplier profile yet. Contact your administrator.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">No requirements yet</p>
          <p className="text-[15px] text-[#8E8E93]">You will be notified when new positions are shared with you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              {/* Status + deadline */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: STATUS_COLORS[entry.status] + '18',
                    color: STATUS_COLORS[entry.status],
                  }}
                >
                  {STATUS_LABELS[entry.status]}
                </span>
                {entry.deadline && (
                  <span className="text-[12px] text-[#8E8E93]">
                    Deadline: {new Date(entry.deadline).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {/* Demand info */}
              <h2 className="text-[18px] font-bold text-black mb-1">{entry.demand.title}</h2>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-[#8E8E93] mb-3">
                <span>{CONTRACT_LABELS[entry.demand.contract_type]}</span>
                {entry.demand.location && (
                  <span>· {entry.demand.location}{entry.demand.remote_allowed ? ' (Remote OK)' : ''}</span>
                )}
                {entry.demand.experience_years != null && (
                  <span>· {entry.demand.experience_years}+ years exp.</span>
                )}
              </div>

              {entry.demand.description && (
                <p className="text-[14px] text-[#3C3C43] mb-3 line-clamp-3 leading-relaxed">
                  {entry.demand.description}
                </p>
              )}

              {entry.demand.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {entry.demand.skills.slice(0, 4).map(skill => (
                    <span key={skill} className="text-[10px] bg-[#007AFF]/10 text-[#007AFF] px-2 py-0.5 rounded-full font-medium">
                      {skill}
                    </span>
                  ))}
                  {entry.demand.skills.length > 4 && (
                    <span className="text-[10px] bg-[#F2F2F7] text-[#8E8E93] px-2 py-0.5 rounded-full font-medium">
                      +{entry.demand.skills.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Budget */}
              {(entry.demand.budget_min || entry.demand.budget_max) && (
                <p className="text-[14px] font-semibold text-black mb-4">
                  {entry.demand.budget_min && entry.demand.budget_max
                    ? `€${entry.demand.budget_min.toLocaleString()} – €${entry.demand.budget_max.toLocaleString()}`
                    : entry.demand.budget_max
                    ? `Up to €${entry.demand.budget_max.toLocaleString()}`
                    : `From €${entry.demand.budget_min?.toLocaleString()}`}
                </p>
              )}

              {/* Submitted candidates */}
              {entry.submissions.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">
                    My Submissions ({entry.submissions.length})
                  </p>
                  <div className="space-y-2">
                    {entry.submissions.map(sub => {
                      const subStatusColor = sub.status === 'hired' ? '#34C759' : sub.status === 'offer' ? '#34C759' : sub.status === 'rejected' ? '#FF3B30' : sub.status === 'interview' ? '#FF9500' : '#007AFF';
                      const subStatusLabel = sub.status === 'proposed' ? 'Under Review' : sub.status === 'shortlisted' ? 'Shortlisted' : sub.status === 'interview' ? 'Interview' : sub.status === 'offer' ? 'Offer Made' : sub.status === 'hired' ? 'Hired' : sub.status === 'rejected' ? 'Not Selected' : sub.status;
                      return (
                        <div key={sub.id} className="bg-[#F9F9FB] rounded-xl px-3.5 py-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-black truncate">{sub.candidateName}</p>
                            {sub.headline && <p className="text-[12px] text-[#8E8E93] truncate">{sub.headline}</p>}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {sub.proposedRate && (
                              <span className="text-[13px] font-semibold text-black">
                                €{sub.proposedRate.toLocaleString()}
                                <span className="text-[11px] font-normal text-[#8E8E93] ml-1">/{sub.rateType ?? 'day'}</span>
                              </span>
                            )}
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: subStatusColor + '18', color: subStatusColor }}>
                              {subStatusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-[#F2F2F7] items-center">
                {entry.status !== 'rejected' && entry.demand.status === 'sourcing' && (
                  <Link
                    href={`/supplier/demands/${entry.demand_id}/submit`}
                    className="px-4 py-2 rounded-[10px] text-white text-[14px] font-semibold transition-opacity hover:opacity-90 flex items-center gap-1.5"
                    style={{ backgroundColor: '#34C759' }}
                  >
                    Submit Candidates
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                )}
                {entry.status !== 'rejected' && entry.demand.status !== 'sourcing' && entry.submissions.length === 0 && (
                  <span className="text-[13px] text-[#8E8E93]">Submissions closed</span>
                )}
                {entry.status !== 'rejected' && entry.status !== 'submitted' && entry.demand.status === 'sourcing' && (
                  <form action={updateDemandSupplierStatus.bind(null, entry.id, 'rejected', entry.demand_id)}>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-[#FF3B30] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 transition-colors"
                    >
                      Decline
                    </button>
                  </form>
                )}
                {entry.status === 'rejected' && (
                  <p className="text-[14px] text-[#8E8E93]">✗ Declined</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Engagements section */}
      {supplierData && engagements.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[20px] font-bold text-black mb-1">Engagements</h2>
          <p className="text-[14px] text-[#8E8E93] mb-4">Commissioned candidates from your submissions</p>
          <div className="space-y-3">
            {engagements.map(e => (
              <div key={e.id} className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: ENG_STATUS_META[e.status].color + '18', color: ENG_STATUS_META[e.status].color }}
                  >
                    {ENG_STATUS_META[e.status].label}
                  </span>
                  <span className="text-[12px] text-[#8E8E93]">
                    {new Date(e.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </div>
                <h3 className="text-[16px] font-bold text-black">{e.candidate_name}</h3>
                <p className="text-[13px] text-[#8E8E93] mt-0.5 mb-3">{e.demand_title}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#3C3C43]">
                  {(e.start_date || e.end_date) && (
                    <span>
                      {fmtDate(e.start_date) ?? '?'}{e.end_date ? ` – ${fmtDate(e.end_date)}` : ''}
                    </span>
                  )}
                  {e.rate && (
                    <span className="font-semibold text-black">
                      {e.currency} {e.rate.toLocaleString()} / {e.rate_type}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
