import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { updateSubmissionStatus } from '@/lib/actions/submissions';
import type { CandidateSubmission, SubmissionStatus } from '@/types/database';

const STATUS_STAGES: { value: SubmissionStatus; label: string; color: string }[] = [
  { value: 'proposed',    label: 'Proposed',    color: '#8E8E93' },
  { value: 'shortlisted', label: 'Shortlisted', color: '#007AFF' },
  { value: 'interview',   label: 'Interview',   color: '#FF9500' },
  { value: 'offer',       label: 'Offer',       color: '#34C759' },
  { value: 'hired',       label: 'Hired',       color: '#34C759' },
  { value: 'rejected',    label: 'Rejected',    color: '#FF3B30' },
];

interface SubmissionWithSupplier extends CandidateSubmission {
  supplier_name?: string;
}

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: demandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!['admin', 'recruiter', 'hiring_manager'].includes(profile?.role ?? '')) {
    redirect('/dashboard');
  }

  const { data: demand } = await supabase
    .from('demands')
    .select('id, title')
    .eq('id', demandId)
    .single();

  if (!demand) redirect('/dashboard/demands');

  const { data: submissions } = await supabase
    .from('candidate_submissions')
    .select('*')
    .eq('demand_id', demandId)
    .order('submitted_at', { ascending: false });

  // Enrich with supplier names
  const subs = (submissions ?? []) as CandidateSubmission[];
  const supplierIds = Array.from(new Set(subs.map(s => s.supplier_id)));
  let supplierNames: Record<string, string> = {};
  if (supplierIds.length > 0) {
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, company_name')
      .in('id', supplierIds);
    supplierNames = Object.fromEntries(
      (suppliers ?? []).map(s => [s.id, s.company_name])
    );
  }

  const enriched: SubmissionWithSupplier[] = subs.map(s => ({
    ...s,
    supplier_name: supplierNames[s.supplier_id],
  }));

  // Group by status
  const byStatus = STATUS_STAGES.reduce((acc, stage) => {
    acc[stage.value] = enriched.filter(s => s.status === stage.value);
    return acc;
  }, {} as Record<SubmissionStatus, SubmissionWithSupplier[]>);

  const total = enriched.length;
  const active = enriched.filter(s => !['rejected', 'hired'].includes(s.status)).length;

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href={`/dashboard/demands/${demandId}`}
        className="inline-flex items-center gap-1 text-[14px] text-[#007AFF] mb-6 hover:opacity-70 transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        {demand.title}
      </Link>

      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-black">Candidate Submissions</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">
          {total} total · {active} in pipeline
        </p>
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">No submissions yet</p>
          <p className="text-[15px] text-[#8E8E93]">
            Suppliers will submit candidates once they respond to this demand.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {STATUS_STAGES.map(stage => {
            const group = byStatus[stage.value];
            if (group.length === 0) return null;
            return (
              <div key={stage.value}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: stage.color + '18', color: stage.color }}
                  >
                    {stage.label}
                  </span>
                  <span className="text-[13px] text-[#8E8E93]">{group.length}</span>
                </div>

                <div className="space-y-2">
                  {group.map(sub => (
                    <div key={sub.id} className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className="text-[16px] font-semibold text-black">{sub.candidate_name}</p>
                            {(sub as SubmissionWithSupplier & { proposed_rate?: number; rate_type?: string }).proposed_rate && (
                              <span className="flex-shrink-0 text-[13px] font-semibold text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                €{(sub as SubmissionWithSupplier & { proposed_rate?: number; rate_type?: string }).proposed_rate?.toLocaleString()}
                                {' '}<span className="font-normal text-[11px]">/ {(sub as SubmissionWithSupplier & { proposed_rate?: number; rate_type?: string }).rate_type ?? 'day'}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-[#8E8E93] mt-0.5">
                            {sub.candidate_email && <span>{sub.candidate_email}</span>}
                            {sub.supplier_name && <span>via {sub.supplier_name}</span>}
                            <span>{new Date(sub.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          {sub.notes && (
                            <p className="text-[13px] text-[#3C3C43] mt-2 leading-relaxed">{sub.notes}</p>
                          )}
                        </div>

                        {/* CV download */}
                        {sub.cv_path && (
                          <CVDownload path={sub.cv_path} />
                        )}
                      </div>

                      {/* Status actions */}
                      {profile?.role !== 'hiring_manager' && (
                        <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-[#F2F2F7]">
                          {STATUS_STAGES.filter(s => s.value !== sub.status).map(s => (
                            <form
                              key={s.value}
                              action={updateSubmissionStatus.bind(null, sub.id, s.value, demandId)}
                            >
                              <button
                                type="submit"
                                className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-colors"
                                style={{
                                  backgroundColor: s.color + '12',
                                  color: s.color,
                                }}
                              >
                                → {s.label}
                              </button>
                            </form>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function CVDownload({ path }: { path: string }) {
  const supabase = await createClient();
  const bucket = path.startsWith('supplier-cvs/') ? 'supplier-cvs' : 'cvs';
  const filePath = path.replace(/^(supplier-cvs|cvs)\//, '');
  const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
  if (!data?.signedUrl) return null;
  return (
    <a
      href={data.signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 flex items-center gap-1.5 text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      CV
    </a>
  );
}
