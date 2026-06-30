import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAwardPeriod } from '@/lib/actions/award-periods';
import { getAvailableCostItems } from '@/lib/actions/cost-items';
import { PeriodDetailClient } from './period-detail-client';

const ALLOWED_ROLES = ['super_admin','admin','recruiter','hiring_manager','procurement','finance','supplier','candidate'];

export default async function PeriodDetailPage({ params }: { params: { periodId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  const role = profile?.role ?? '';
  if (!ALLOWED_ROLES.includes(role)) redirect('/dashboard');

  const period = await getAwardPeriod(params.periodId);
  if (!period) notFound();

  // Fetch the award to get contract type for cost item filtering
  const { data: award } = await adminDb
    .from('awards')
    .select('id, candidate_name, demand_title, supplier_name, rate, rate_type, currency, start_date, end_date, status, demand_id')
    .eq('id', period.award_id)
    .single();

  let contractType: string | undefined;
  if (award?.demand_id) {
    const { data: demand } = await adminDb.from('demands').select('contract_type').eq('id', award.demand_id).single();
    contractType = demand?.contract_type ?? undefined;
  }

  const costItems = await getAvailableCostItems({
    contractType,
    tenantId: profile?.tenant_id ?? undefined,
  });

  return (
    <PeriodDetailClient
      period={period}
      award={award}
      costItems={costItems}
      role={role}
      userId={user.id}
    />
  );
}
