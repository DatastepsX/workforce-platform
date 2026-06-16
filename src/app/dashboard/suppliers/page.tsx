import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { deleteSupplier } from '@/lib/actions/suppliers';
import { DeleteButton } from '@/components/DeleteButton';
import type { Supplier } from '@/types/database';

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter'].includes(profile?.role ?? '')) redirect('/dashboard');

  const role = profile?.role ?? '';

  const { data } = await supabase
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
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          {suppliers.map((s, i) => (
            <div key={s.id}>
              {i > 0 && <div className="ml-[68px] h-px bg-[#F2F2F7]" />}
              <div className="flex items-center gap-3 px-4 py-4">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[15px] font-semibold flex-shrink-0"
                  style={{ backgroundColor: s.status === 'active' ? '#007AFF' : '#8E8E93' }}
                >
                  {s.company_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-semibold text-black truncate">{s.company_name}</p>
                    {s.status === 'inactive' && (
                      <span className="text-[11px] bg-[#8E8E93]/12 text-[#8E8E93] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#8E8E93] truncate">
                    {s.contact_name ? `${s.contact_name} · ` : ''}{s.email}
                  </p>
                  {s.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.specializations.map(spec => (
                        <span key={spec} className="text-[11px] bg-[#F2F2F7] text-[#3C3C43] px-2 py-0.5 rounded-full">
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    className="text-[13px] text-[#007AFF] flex-shrink-0 hidden sm:block"
                  >
                    {s.phone}
                  </a>
                )}
                {role === 'admin' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/dashboard/suppliers/${s.id}/edit`}
                      className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#007AFF] hover:bg-[#007AFF]/8 transition-colors"
                    >
                      Edit
                    </Link>
                    <DeleteButton
                      action={deleteSupplier}
                      id={s.id}
                      confirmMessage={`Delete "${s.company_name}"? This cannot be undone.`}
                      label="Delete"
                      className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors disabled:opacity-40"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
