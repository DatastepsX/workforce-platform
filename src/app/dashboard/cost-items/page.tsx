import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listAllPeriods } from '@/lib/actions/award-periods';
import { CostItemsInboxClient } from './cost-items-inbox-client';

const ALLOWED_ROLES = ['super_admin','admin','recruiter','hiring_manager','procurement','finance','supplier','candidate'];

export default async function CostItemsInboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  const role = profile?.role ?? '';
  if (!ALLOWED_ROLES.includes(role)) redirect('/dashboard');

  // For supplier: fetch their supplier record to filter by supplier_id
  let supplierAwardIds: string[] | null = null;
  if (role === 'supplier') {
    const { data: supplierRow } = await adminDb.from('suppliers').select('id').eq('profile_id', user.id).single();
    if (supplierRow) {
      const { data: awards } = await adminDb.from('awards').select('id').eq('supplier_id', supplierRow.id);
      supplierAwardIds = (awards ?? []).map((a: { id: string }) => a.id);
    }
  }

  // For candidate: fetch their award IDs
  let candidateAwardIds: string[] | null = null;
  if (role === 'candidate') {
    const { data: subs } = await adminDb
      .from('candidate_submissions')
      .select('id')
      .eq('candidate_profile_id', user.id);
    if (subs?.length) {
      const subIds = subs.map((s: { id: string }) => s.id);
      const { data: awards } = await adminDb
        .from('awards')
        .select('id')
        .in('submission_id', subIds);
      candidateAwardIds = (awards ?? []).map((a: { id: string }) => a.id);
    }
  }

  const tenantId = profile?.tenant_id ?? undefined;
  let periods = await listAllPeriods({ tenantId: role !== 'super_admin' ? tenantId : undefined });

  // Additional filter for supplier/candidate (RLS handles DB-level, but listAllPeriods uses adminDb)
  if (supplierAwardIds !== null) {
    periods = periods.filter(p => supplierAwardIds!.includes(p.award_id));
  }
  if (candidateAwardIds !== null) {
    periods = periods.filter(p => candidateAwardIds!.includes(p.award_id));
  }

  return <CostItemsInboxClient periods={periods} role={role} userId={user.id} />;
}
