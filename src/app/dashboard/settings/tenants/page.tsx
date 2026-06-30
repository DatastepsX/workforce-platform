import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createTenant } from '@/lib/actions/tenants';
import { GenerateTenantButton } from './generate-tenant-button';

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  const role = profile?.role ?? '';

  // admin goes directly to their own tenant config; super_admin sees the list
  if (role === 'admin') {
    if (profile?.tenant_id) redirect(`/dashboard/settings/tenants/${profile.tenant_id}`);
    else redirect('/dashboard');
  }
  if (role !== 'super_admin') redirect('/dashboard');

  const admin = createAdminClient();
  const { data: tenants } = await admin
    .from('tenants')
    .select('*')
    .order('name');

  async function handleCreate(formData: FormData) {
    'use server';
    const result = await createTenant(formData);
    if (result?.id) redirect(`/dashboard/settings/tenants/${result.id}`);
  }

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[13px] text-[#8E8E93] mb-1">Settings</p>
          <h1 className="text-[28px] font-bold tracking-tight text-black">Tenants</h1>
        </div>
        <GenerateTenantButton />
      </div>

      {/* Tenant list */}
      {tenants && tenants.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] divide-y divide-[#F2F2F7] mb-6">
          {tenants.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/settings/tenants/${t.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-[#F2F2F7]/50 transition-colors"
            >
              <div>
                <p className="text-[15px] font-semibold text-black">{t.name}</p>
                <p className="text-[13px] text-[#8E8E93]">{t.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: t.active ? '#34C75918' : '#8E8E9318',
                    color: t.active ? '#34C759' : '#8E8E93',
                  }}
                >
                  {t.active ? 'Active' : 'Inactive'}
                </span>
                <svg className="w-4 h-4 text-[#C7C7CC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-6">
          <p className="text-[17px] font-semibold text-black mb-1">No tenants yet</p>
          <p className="text-[15px] text-[#8E8E93]">Create your first client company below.</p>
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-4">New Tenant</p>
        <form action={handleCreate} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Company Name</label>
            <input
              name="name"
              required
              placeholder="e.g. Siemens AG"
              className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Slug</label>
            <input
              name="slug"
              required
              placeholder="e.g. siemens-ag"
              className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
            />
            <p className="text-[12px] text-[#8E8E93] mt-1">Lowercase letters, numbers and hyphens only</p>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-[10px] text-white text-[14px] font-semibold"
            style={{ backgroundColor: '#007AFF' }}
          >
            Create Tenant
          </button>
        </form>
      </div>
    </div>
  );
}
