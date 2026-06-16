import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SubmitPanel } from './submit-panel';
import type { Demand, SupplierCandidate, CandidateSubmission } from '@/types/database';

export default async function SubmitCandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: demandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get supplier
  const { data: supplierData } = await supabase
    .from('suppliers')
    .select('id, company_name')
    .eq('profile_id', user.id)
    .single();

  if (!supplierData) redirect('/supplier');

  // Verify this demand was sent to this supplier
  const { data: dsEntry } = await supabase
    .from('demand_suppliers')
    .select('id, status, deadline')
    .eq('demand_id', demandId)
    .eq('supplier_id', supplierData.id)
    .single();

  if (!dsEntry) redirect('/supplier');

  // Fetch demand
  const { data: demand } = await supabase
    .from('demands')
    .select('*')
    .eq('id', demandId)
    .single();

  if (!demand) redirect('/supplier');

  // Fetch supplier's candidate pool
  const { data: pool } = await supabase
    .from('supplier_candidates')
    .select('*')
    .eq('supplier_id', supplierData.id)
    .order('created_at', { ascending: false });

  // Fetch already submitted candidates for this demand
  const { data: existing } = await supabase
    .from('candidate_submissions')
    .select('*')
    .eq('demand_id', demandId)
    .eq('supplier_id', supplierData.id);

  const d = demand as Demand;
  const candidates = (pool ?? []) as SupplierCandidate[];
  const submissions = (existing ?? []) as CandidateSubmission[];
  const submittedIds = Array.from(new Set(
    submissions.map(s => s.supplier_candidate_id).filter((id): id is string => id !== null)
  ));

  return (
    <div className="px-5 py-8 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/supplier"
        className="inline-flex items-center gap-1 text-[14px] text-[#007AFF] mb-6 hover:opacity-70 transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Back to Demands
      </Link>

      {/* Demand summary */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-6">
        <h1 className="text-[22px] font-bold text-black mb-1">{d.title}</h1>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-[#8E8E93] mb-3">
          <span>{d.contract_type}</span>
          {d.location && <span>· {d.location}{d.remote_allowed ? ' (Remote OK)' : ''}</span>}
          {d.experience_years != null && <span>· {d.experience_years}+ yrs exp.</span>}
          {dsEntry.deadline && (
            <span>· Deadline: {new Date(dsEntry.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>
        {d.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.skills.map(skill => (
              <span key={skill} className="text-[11px] bg-[#007AFF]/10 text-[#007AFF] px-2.5 py-0.5 rounded-full font-medium">
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Already submitted */}
      {submissions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2 px-1">
            Already Submitted ({submissions.length})
          </h2>
          <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] divide-y divide-[#F2F2F7]">
            {submissions.map(sub => (
              <div key={sub.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-black">{sub.candidate_name}</p>
                  {sub.candidate_email && (
                    <p className="text-[13px] text-[#8E8E93]">{sub.candidate_email}</p>
                  )}
                </div>
                <StatusBadge status={sub.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit panel */}
      <SubmitPanel
        demandId={demandId}
        candidates={candidates}
        submittedIds={submittedIds}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    proposed:    { label: 'Proposed',    color: '#007AFF' },
    shortlisted: { label: 'Shortlisted', color: '#FF9500' },
    interview:   { label: 'Interview',   color: '#FF9500' },
    offer:       { label: 'Offer',       color: '#34C759' },
    hired:       { label: 'Hired',       color: '#34C759' },
    rejected:    { label: 'Rejected',    color: '#FF3B30' },
  };
  const { label, color } = map[status] ?? { label: status, color: '#8E8E93' };
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: color + '18', color }}
    >
      {label}
    </span>
  );
}
