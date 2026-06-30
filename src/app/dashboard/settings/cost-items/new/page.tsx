import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listCostItemCategories, createCostItem } from '@/lib/actions/cost-items';
import { CostItemForm } from '../cost-item-form';
import Link from 'next/link';

export default async function NewCostItemPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') redirect('/dashboard');

  const categories = await listCostItemCategories();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-4">
        <Link href="/dashboard/settings/cost-items" className="hover:text-[#007AFF]">Cost Items</Link>
        <span>/</span>
        <span className="text-black">New</span>
      </div>
      <h1 className="text-[22px] font-bold text-black mb-6">New Cost Item</h1>
      <CostItemForm categories={categories} onSave={createCostItem} />
    </div>
  );
}
