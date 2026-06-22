import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Supplier } from '@/types/database';
import { SuppliersListClient } from './suppliers-list-client';

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['super_admin', 'admin', 'recruiter'].includes(profile?.role ?? '')) redirect('/dashboard');

  const role = profile?.role ?? '';

  const admin = createAdminClient();
  const { data } = await admin
    .from('suppliers')
    .select('*')
    .order('company_name');

  const suppliers = (data ?? []) as Supplier[];

  return (
    <div className="px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Suppliers</h1>
          <p className="text-[15px] text-[#8E8E93] mt-0.5">{suppliers.length} registered</p>
        </div>
        <Link
          href="/dashboard/suppliers/new"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] text-white text-[15px] font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.28)' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Supplier
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">No suppliers yet</p>
          <p className="text-[15px] text-[#8E8E93]">Add your first supplier to start distributing demands.</p>
        </div>
      ) : (
        <SuppliersListClient suppliers={suppliers} role={role} />
      )}
    </div>
  );
}
