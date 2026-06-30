import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listCostItems, deleteCostItem } from '@/lib/actions/cost-items';
import { CostItemsClient } from './cost-items-client';

export default async function CostItemsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') redirect('/dashboard');

  const items = await listCostItems();

  return <CostItemsClient items={items} onDelete={deleteCostItem} />;
}
