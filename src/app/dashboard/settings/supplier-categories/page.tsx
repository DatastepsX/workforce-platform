import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SupplierCategoriesClient } from './supplier-categories-client';
import type { SupplierCategory, Supplier } from '@/types/database';

export default async function SupplierCategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) redirect('/dashboard');

  const admin = createAdminClient();
  const [{ data: catsData }, { data: suppliersData }, { data: membersData }] = await Promise.all([
    admin.from('supplier_categories').select('*').order('name'),
    admin.from('suppliers').select('id, company_name, contact_name, status').eq('status', 'active').order('company_name'),
    admin.from('supplier_category_members').select('supplier_id, supplier_category_id'),
  ]);

  const categories = (catsData ?? []) as SupplierCategory[];
  const suppliers = (suppliersData ?? []) as Pick<Supplier, 'id' | 'company_name' | 'contact_name' | 'status'>[];
  const members = (membersData ?? []) as { supplier_id: string; supplier_category_id: string }[];

  const memberMap: Record<string, string[]> = {};
  for (const m of members) {
    if (!memberMap[m.supplier_category_id]) memberMap[m.supplier_category_id] = [];
    memberMap[m.supplier_category_id].push(m.supplier_id);
  }

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/settings/tenants" className="hover:text-[#007AFF] transition-colors">Settings</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-black font-medium">Supplier Categories</span>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-[28px] font-bold tracking-tight text-black flex-1">Supplier Categories</h1>
      </div>

      <p className="text-[14px] text-[#8E8E93] mb-6">
        Global categories group suppliers by specialization. Assign categories to job descriptions to auto-route demands to the right suppliers.
      </p>

      <SupplierCategoriesClient
        categories={categories}
        suppliers={suppliers}
        memberMap={memberMap}
      />
    </div>
  );
}
