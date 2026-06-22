import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { updateTenant, updateTenantConfig, saveTenantRoles } from '@/lib/actions/tenants';
import { UsersSection } from './users-section';
import { SuppliersSection } from './suppliers-section';
import { DeleteTenantButton } from './delete-tenant-button';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TenantRole, TenantSupplier, Supplier } from '@/types/database';

interface PageProps {
  params: Promise<{ id: string }>;
}

function Toggle({ name, label, checked, description }: { name: string; label: string; checked: boolean; description?: string }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F2F2F7] last:border-0 gap-4">
      <div className="flex-1">
        <p className="text-[14px] font-medium text-black">{label}</p>
        {description && <p className="text-[12px] text-[#8E8E93] mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
        <input type="hidden" name={name} value="false" />
        <input type="checkbox" name={name} value="true" defaultChecked={checked} className="sr-only peer" />
        <div className="w-10 h-6 bg-[#E5E5EA] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
      </label>
    </div>
  );
}

function ApprovalLevels({ prefix, levels, role1, role2, role3 }: {
  prefix: string; levels: number; role1: string | null; role2: string | null; role3: string | null;
}) {
  const ROLES = ['hiring_manager', 'admin', 'recruiter', 'procurement', 'finance'];
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Approval Levels</label>
        <select
          name={`${prefix}_approval_levels`}
          defaultValue={levels}
          className="w-full h-10 px-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]"
        >
          <option value={0}>0 — No approval required</option>
          <option value={1}>1 — Single approver</option>
          <option value={2}>2 — Two approvers</option>
          <option value={3}>3 — Three approvers</option>
        </select>
      </div>
      {[
        { n: 1, defaultVal: role1 },
        { n: 2, defaultVal: role2 },
        { n: 3, defaultVal: role3 },
      ].map(({ n, defaultVal }) => (
        <div key={n}>
          <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Level {n} Approver Role</label>
          <select
            name={`${prefix}_approval_role_l${n}`}
            defaultValue={defaultVal ?? ''}
            className="w-full h-10 px-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]"
          >
            <option value="">— not used —</option>
            {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

export default async function TenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) redirect('/dashboard');

  const admin = createAdminClient();
  const [{ data: tenant }, { data: config }, { data: rolesData }, { data: usersData }, { data: allSuppliersData }, { data: tenantSuppliersData }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', id).single(),
    supabase.from('tenant_configs').select('*').eq('tenant_id', id).single(),
    supabase.from('tenant_roles').select('*').eq('tenant_id', id).order('role_key'),
    supabase.from('profiles').select('id, email, full_name, role').eq('tenant_id', id).order('role'),
    admin.from('suppliers').select('id, company_name, email, contact_name').eq('status', 'active').order('company_name'),
    admin.from('tenant_suppliers').select('*').eq('tenant_id', id),
  ]);

  if (!tenant) notFound();

  const t = tenant as { id: string; name: string; slug: string; active: boolean; created_at: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = config as any;
  const roles = (rolesData ?? []) as TenantRole[];
  const tenantUsers = (usersData ?? []) as { id: string; email: string | null; full_name: string | null; role: string }[];
  const allSuppliers = (allSuppliersData ?? []) as Pick<Supplier, 'id' | 'company_name' | 'email' | 'contact_name'>[];
  const tenantSupplierMap = Object.fromEntries(
    ((tenantSuppliersData ?? []) as TenantSupplier[]).map(ts => [ts.supplier_id, ts])
  );
  const supplierRows = allSuppliers.map(s => ({
    ...s,
    assigned: !!tenantSupplierMap[s.id],
    active: tenantSupplierMap[s.id]?.active ?? false,
  }));

  const PREDEFINED_ROLES = [
    { key: 'admin',          defaultLabel: 'MSP Admin' },
    { key: 'recruiter',      defaultLabel: 'MSP Service' },
    { key: 'hiring_manager', defaultLabel: 'Client HM' },
    { key: 'procurement',    defaultLabel: 'Procurement' },
    { key: 'finance',        defaultLabel: 'Finance' },
    { key: 'supplier',       defaultLabel: 'Supplier' },
    { key: 'candidate',      defaultLabel: 'Candidate' },
  ];
  const roleMap = Object.fromEntries(roles.map(r => [r.role_key, r]));

  async function handleUpdateTenant(formData: FormData) {
    'use server';
    await updateTenant(id, formData);
  }

  async function handleUpdateConfig(formData: FormData) {
    'use server';
    await updateTenantConfig(id, formData);
  }

  async function handleSaveRoles(formData: FormData) {
    'use server';
    await saveTenantRoles(id, formData);
  }

  return (
    <div className="px-8 py-10 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/settings/tenants" className="hover:text-[#007AFF] transition-colors">Tenants</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-black font-medium">{t.name}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-black flex-1">{t.name}</h1>
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: t.active ? '#34C75918' : '#8E8E9318', color: t.active ? '#34C759' : '#8E8E93' }}
        >
          {t.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Tenant details */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-4">Details</p>
        <form action={handleUpdateTenant} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Company Name</label>
            <input
              name="name"
              required
              defaultValue={t.name}
              className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Slug</label>
            <input
              name="slug"
              required
              defaultValue={t.slug}
              className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[14px] font-medium text-black">Active</p>
              <p className="text-[12px] text-[#8E8E93]">Inactive tenants are hidden from the platform</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="hidden" name="active" value="false" />
              <input type="checkbox" name="active" value="true" defaultChecked={t.active} className="sr-only peer" />
              <div className="w-10 h-6 bg-[#E5E5EA] rounded-full peer peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-[10px] text-white text-[14px] font-semibold"
            style={{ backgroundColor: '#007AFF' }}
          >
            Save Details
          </button>
        </form>
      </div>

      {/* Workflow configuration */}
      <form action={handleUpdateConfig}>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Demand Workflow</p>
          <Toggle
            name="demand_msp_review"
            label="MSP Review step"
            checked={cfg?.demand_msp_review ?? true}
            description="Demand goes through MSP recruiter review before approval"
          />
          <Toggle
            name="demand_msp_screening"
            label="MSP Screening step"
            checked={cfg?.demand_msp_screening ?? true}
            description="MSP screens submitted candidates before presenting to client"
          />
          <div className="pt-3">
            <ApprovalLevels
              prefix="demand"
              levels={cfg?.demand_approval_levels ?? 1}
              role1={cfg?.demand_approval_role_l1 ?? 'hiring_manager'}
              role2={cfg?.demand_approval_role_l2 ?? null}
              role3={cfg?.demand_approval_role_l3 ?? null}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Award Workflow</p>
          <Toggle
            name="award_msp_offer"
            label="MSP manages offer"
            checked={cfg?.award_msp_offer ?? true}
            description="MSP handles rate negotiation and offer to supplier"
          />
          <Toggle
            name="award_po_step"
            label="PO / Contracting step"
            checked={cfg?.award_po_step ?? false}
            description="Require a purchase order or contract before award is finalised"
          />
          <div className="pt-3">
            <ApprovalLevels
              prefix="award"
              levels={cfg?.award_approval_levels ?? 1}
              role1={cfg?.award_approval_role_l1 ?? 'procurement'}
              role2={cfg?.award_approval_role_l2 ?? null}
              role3={cfg?.award_approval_role_l3 ?? null}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-[10px] text-white text-[14px] font-semibold"
          style={{ backgroundColor: '#007AFF' }}
        >
          Save Workflow Configuration
        </button>
      </form>

      {/* WFX-022: Role configuration */}
      <form action={handleSaveRoles}>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-4">Roles</p>
          <div className="space-y-3">
            {PREDEFINED_ROLES.map(({ key, defaultLabel }) => {
              const existing = roleMap[key];
              return (
                <div key={key} className="flex items-center gap-3 py-2 border-b border-[#F2F2F7] last:border-0">
                  <div className="flex-1">
                    <input
                      name={`role_label_${key}`}
                      defaultValue={existing?.label ?? defaultLabel}
                      placeholder={defaultLabel}
                      className="w-full px-3 py-1.5 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]"
                    />
                    <p className="text-[11px] text-[#8E8E93] mt-0.5 pl-1">platform role: {key}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input type="hidden" name={`role_active_${key}`} value="false" />
                    <input
                      type="checkbox"
                      name={`role_active_${key}`}
                      value="true"
                      defaultChecked={existing?.active ?? true}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-[#E5E5EA] rounded-full peer peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          className="w-full py-2.5 rounded-[10px] text-white text-[14px] font-semibold mb-4"
          style={{ backgroundColor: '#007AFF' }}
        >
          Save Role Configuration
        </button>
      </form>

      {/* Supplier assignments */}
      <SuppliersSection tenantId={id} suppliers={supplierRows} />

      {/* WFX-023: User management */}
      <UsersSection tenantId={id} users={tenantUsers} />

      {/* Danger zone — super_admin only */}
      {profile?.role === 'super_admin' && (
        <div className="mt-6">
          <p className="text-[12px] font-semibold text-[#FF3B30] uppercase tracking-[0.6px] mb-3">Danger Zone</p>
          <DeleteTenantButton tenantId={id} tenantName={t.name} />
        </div>
      )}
    </div>
  );
}
