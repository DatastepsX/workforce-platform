import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { updateDemandSupplierStatus } from '@/lib/actions/suppliers';
import type { Demand, DemandSupplier, DemandSupplierStatus } from '@/types/database';

const STATUS_COLORS: Record<DemandSupplierStatus, string> = {
  sent: '#007AFF',
  viewed: '#FF9500',
  submitted: '#34C759',
  rejected: '#FF3B30',
};

const STATUS_LABELS: Record<DemandSupplierStatus, string> = {
  sent: 'New',
  viewed: 'Viewed',
  submitted: 'Submitted',
  rejected: 'Rejected',
};

const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'Permanent',
  freelance: 'Freelance',
  contractor: 'Contractor',
  internship: 'Internship',
};

interface DemandEntry extends DemandSupplier {
  demand: Demand;
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
    const { data: dsData } = await supabase
      .from('demand_suppliers')
      .select('*')
      .eq('supplier_id', supplierData.id)
      .order('sent_at', { ascending: false });

    if (dsData && dsData.length > 0) {
      const demandIds = (dsData as DemandSupplier[]).map(d => d.demand_id);
      const { data: demandsData } = await supabase
        .from('demands')
        .select('*')
        .in('id', demandIds);

      const demandsMap = Object.fromEntries(
        ((demandsData ?? []) as Demand[]).map(d => [d.id, d])
      );

      entries = (dsData as DemandSupplier[])
        .map(ds => ({ ...ds, demand: demandsMap[ds.demand_id] }))
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

  return (
    <div className="px-5 py-8 max-w-2xl mx-auto">
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
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {entry.demand.skills.map(skill => (
                    <span key={skill} className="text-[11px] bg-[#007AFF]/10 text-[#007AFF] px-2.5 py-0.5 rounded-full font-medium">
                      {skill}
                    </span>
                  ))}
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

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-[#F2F2F7]">
                {entry.status !== 'submitted' && entry.status !== 'rejected' && (
                  <form action={updateDemandSupplierStatus.bind(null, entry.id, 'submitted', entry.demand_id)}>
                    <button
                      type="submit"
                      className="mt-3 px-4 py-2 rounded-[10px] text-white text-[14px] font-semibold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#34C759' }}
                    >
                      Submit Candidates
                    </button>
                  </form>
                )}
                {entry.status !== 'rejected' && entry.status !== 'submitted' && (
                  <form action={updateDemandSupplierStatus.bind(null, entry.id, 'rejected', entry.demand_id)}>
                    <button
                      type="submit"
                      className="mt-3 px-4 py-2 rounded-[10px] text-[14px] font-medium text-[#FF3B30] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 transition-colors"
                    >
                      Decline
                    </button>
                  </form>
                )}
                {(entry.status === 'submitted' || entry.status === 'rejected') && (
                  <p className="mt-3 text-[14px] text-[#8E8E93] pt-0.5">
                    {entry.status === 'submitted' ? '✓ Candidates submitted' : '✗ Declined'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
