import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listCostItemCategories, getCostItem, updateCostItem } from '@/lib/actions/cost-items';
import { CostItemForm } from '../cost-item-form';
import Link from 'next/link';

export default async function EditCostItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') redirect('/dashboard');

  const [item, categories] = await Promise.all([
    getCostItem(id),
    listCostItemCategories(),
  ]);

  if (!item) notFound();

  const save = async (formData: FormData) => {
    'use server';
    await updateCostItem(id, formData);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-4">
        <Link href="/dashboard/settings/cost-items" className="hover:text-[#007AFF]">Cost Items</Link>
        <span>/</span>
        <span className="text-black font-mono">{item.code}</span>
      </div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-black">{item.name}</h1>
          <p className="text-[13px] text-[#8E8E93] font-mono">{item.code}</p>
        </div>
        <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${item.active ? 'bg-[#E8FAF0] text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
          {item.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <CostItemForm categories={categories} item={item} onSave={save} />
    </div>
  );
}
