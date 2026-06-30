import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SubmissionsInboxClient } from './submissions-inbox-client';

type SubmissionRow = {
  id: string;
  demand_id: string;
  supplier_id: string | null;
  candidate_profile_id: string | null;
  candidate_name: string;
  candidate_email: string | null;
  status: string;
  source: string;
  submitted_at: string;
  proposed_rate: number | null;
  rate_type: string | null;
  notes: string | null;
  cv_path: string | null;
  demands: { id: string; title: string } | null;
  suppliers: { company_name: string } | null;
};

export default async function SubmissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  const role = profile?.role ?? '';
  if (!['super_admin', 'admin', 'recruiter', 'hiring_manager'].includes(role)) redirect('/dashboard');

  const admin = createAdminClient();
  const tenantId = profile?.tenant_id ?? null;

  let submissions: SubmissionRow[] = [];

  if (role !== 'super_admin' && tenantId) {
    // Fetch demand IDs for this tenant, then filter submissions
    const { data: tenantDemands } = await admin.from('demands').select('id').eq('tenant_id', tenantId);
    const demandIds = (tenantDemands ?? []).map((d: { id: string }) => d.id);
    if (demandIds.length > 0) {
      const { data } = await admin
        .from('candidate_submissions')
        .select('*, demands(id, title), suppliers(company_name)')
        .in('demand_id', demandIds)
        .order('submitted_at', { ascending: false });
      submissions = (data ?? []) as SubmissionRow[];
    }
  } else {
    const { data } = await admin
      .from('candidate_submissions')
      .select('*, demands(id, title), suppliers(company_name)')
      .order('submitted_at', { ascending: false });
    submissions = (data ?? []) as SubmissionRow[];
  }

  return (
    <div className="px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Submissions</h1>
          <p className="text-[15px] text-[#8E8E93] mt-0.5">All candidate submissions across demands</p>
        </div>
        {submissions.length > 0 && (
          <div className="text-right">
            <p className="text-[22px] font-bold text-black leading-tight">
              {submissions.filter(s => s.status === 'proposed').length}
            </p>
            <p className="text-[12px] text-[#8E8E93]">awaiting review</p>
          </div>
        )}
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold text-black mb-1">No submissions yet</p>
          <p className="text-[14px] text-[#8E8E93] mb-5">
            Submissions will appear here once suppliers or candidates apply.
          </p>
          <Link href="/dashboard/demands" className="inline-block px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold" style={{ backgroundColor: '#007AFF' }}>
            View Demands →
          </Link>
        </div>
      ) : (
        <SubmissionsInboxClient submissions={submissions} />
      )}
    </div>
  );
}
