import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { updateTenant, updateTenantConfig, saveTenantRoles } from '@/lib/actions/tenants';
import { listComplianceRules, listTenantRuleOverrides, upsertTenantRuleOverride, resetTenantRuleOverride } from '@/lib/actions/compliance';
import { UsersSection } from './users-section';
import { SuppliersSection } from './suppliers-section';
import { OrgUnitsSection } from './org-units-section';
import { JobDescriptionsSection } from './job-descriptions-section';
import { SupplierCategoriesSection } from './supplier-categories-section';
import { DeleteTenantButton } from './delete-tenant-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { WorkflowVisualizer } from '@/components/WorkflowVisualizer';
import { RunScenarioButton } from '@/app/dashboard/dev/test-scenarios/run-button-client';
import { getScenarioRuns } from '@/lib/actions/scenario-runs';
import { TenantConfigNav } from './tenant-config-nav';
import { GenerateTestDataButton } from './generate-test-data-button';
import { TenantConfigSearch } from './tenant-config-search';
import type { TenantRole, TenantSupplier, Supplier, OrgUnit, JobDescription, SupplierCategory, TenantConfig } from '@/types/database';

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

  const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  const viewerRole = profile?.role ?? '';
  if (!['admin', 'super_admin'].includes(viewerRole)) redirect('/dashboard');
  // admin can only access their own tenant
  if (viewerRole === 'admin' && profile?.tenant_id !== id) redirect('/dashboard');

  const admin = createAdminClient();
  const [
    { data: tenant },
    { data: config },
    { data: rolesData },
    { data: usersData },
    { data: allSuppliersData },
    { data: tenantSuppliersData },
    { data: laddersData },
    { data: orgUnitsData },
    { data: jobDescriptionsData },
    { data: allCategoriesData },
    { data: tenantCategoriesData },
    { data: jdCategoriesData },
  ] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', id).single(),
    supabase.from('tenant_configs').select('*').eq('tenant_id', id).single(),
    supabase.from('tenant_roles').select('*').eq('tenant_id', id).order('role_key'),
    admin.from('profiles').select('id, email, full_name, role, org_unit_id').eq('tenant_id', id).order('role'),
    admin.from('suppliers').select('id, company_name, email, contact_name').eq('status', 'active').order('company_name'),
    admin.from('tenant_suppliers').select('*').eq('tenant_id', id),
    admin.from('career_ladders').select('id, name, industry').eq('tenant_id', id).order('name'),
    admin.from('org_units').select('*').eq('tenant_id', id).order('position').order('name'),
    admin.from('job_descriptions').select('*').eq('tenant_id', id).order('title'),
    admin.from('supplier_categories').select('*').order('name'),
    admin.from('tenant_supplier_categories').select('supplier_category_id').eq('tenant_id', id),
    admin.from('jd_supplier_categories').select('job_description_id, supplier_category_id'),
  ]);

  if (!tenant) notFound();

  const [complianceRules, complianceOverrides] = await Promise.all([
    listComplianceRules(),
    listTenantRuleOverrides(id),
  ]);

  const lastRuns = await getScenarioRuns(id, 3);
  const latestRun = lastRuns[0] ?? null;

  const t = tenant as { id: string; name: string; slug: string; active: boolean; created_at: string };
  const tenantLadders = (laddersData ?? []) as { id: string; name: string; industry: string | null }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = config as any;
  const roles = (rolesData ?? []) as TenantRole[];
  const tenantUsers = (usersData ?? []) as { id: string; email: string | null; full_name: string | null; role: string; org_unit_id: string | null }[];
  const allSuppliers = (allSuppliersData ?? []) as Pick<Supplier, 'id' | 'company_name' | 'email' | 'contact_name'>[];
  const tenantSupplierMap = Object.fromEntries(
    ((tenantSuppliersData ?? []) as TenantSupplier[]).map(ts => [ts.supplier_id, ts])
  );
  const supplierRows = allSuppliers.map(s => ({
    ...s,
    assigned: !!tenantSupplierMap[s.id],
    active: tenantSupplierMap[s.id]?.active ?? false,
  }));
  const orgUnits = (orgUnitsData ?? []) as OrgUnit[];
  // Build JD list enriched with supplier_category_ids
  const jdCatMap: Record<string, string[]> = {};
  for (const row of (jdCategoriesData ?? []) as { job_description_id: string; supplier_category_id: string }[]) {
    if (!jdCatMap[row.job_description_id]) jdCatMap[row.job_description_id] = [];
    jdCatMap[row.job_description_id].push(row.supplier_category_id);
  }
  const jobDescriptions = ((jobDescriptionsData ?? []) as JobDescription[]).map(jd => ({
    ...jd,
    supplier_category_ids: jdCatMap[jd.id] ?? [],
  }));
  const allCategories = (allCategoriesData ?? []) as SupplierCategory[];
  const assignedCategoryIds = ((tenantCategoriesData ?? []) as { supplier_category_id: string }[]).map(r => r.supplier_category_id);

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

      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-[28px] font-bold tracking-tight text-black flex-1">{t.name}</h1>
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: t.active ? '#34C75918' : '#8E8E9318', color: t.active ? '#34C759' : '#8E8E93' }}
        >
          {t.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Global config search */}
      <TenantConfigSearch
        users={tenantUsers}
        suppliers={supplierRows.map(s => ({ id: s.id, company_name: s.company_name, email: s.email, assigned: s.assigned }))}
        orgUnits={orgUnits}
        jobDescriptions={jobDescriptions.map(j => ({ id: j.id, title: j.title, org_unit_id: j.org_unit_id }))}
        supplierCategories={allCategories.map(c => ({ id: c.id, name: c.name, assigned: assignedCategoryIds.includes(c.id) }))}
      />

      {/* Sticky section navigation */}
      <TenantConfigNav />

      {/* Tenant details */}
      <div id="section-details" className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
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

      {/* E2E Process Flow Visualizer + Test Scenarios */}
      {cfg && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <WorkflowVisualizer config={cfg as TenantConfig} />

          <div className="mt-4 pt-4 border-t border-[#F2F2F7] flex items-center gap-4 flex-wrap">
            <RunScenarioButton tenantId={id} tenantName={t.name} compact />
            <GenerateTestDataButton tenantId={id} />
            {latestRun ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: (latestRun.happy_fail + latestRun.unhappy_fail) === 0 ? '#34C759' : '#FF3B30' }}
                />
                <span className="text-[11px] text-[#8E8E93]">
                  Last run: {new Date(latestRun.run_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                  {' · '}
                  <span style={{ color: (latestRun.happy_fail + latestRun.unhappy_fail) === 0 ? '#34C759' : '#FF3B30', fontWeight: 600 }}>
                    {(latestRun.happy_fail + latestRun.unhappy_fail) === 0
                      ? `✓ ${latestRun.happy_pass + latestRun.unhappy_pass}/${latestRun.total_steps} passed`
                      : `⚠ ${latestRun.happy_fail + latestRun.unhappy_fail} issues`
                    }
                  </span>
                </span>
                <Link href="/dashboard/dev/test-scenarios" className="text-[11px] text-[#007AFF] hover:underline">
                  View details →
                </Link>
              </div>
            ) : (
              <span className="text-[11px] text-[#8E8E93]">No runs yet</span>
            )}
          </div>
        </div>
      )}

      {/* Workflow configuration */}
      <form action={handleUpdateConfig}>
        <div id="section-workflow" className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
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

        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Cost Item Workflow</p>
          <Toggle
            name="cost_msp_review"
            label="MSP Review cost entries"
            checked={cfg?.cost_msp_review ?? true}
            description="MSP Recruiter must review submitted timesheets and expenses before HM approval"
          />
          <Toggle
            name="cost_hm_approval"
            label="Hiring Manager approval"
            checked={cfg?.cost_hm_approval ?? true}
            description="Hiring Manager must approve billing periods before invoicing"
          />
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
        <div id="section-roles" className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
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
      <div id="section-suppliers">
      <SuppliersSection tenantId={id} suppliers={supplierRows} />

      {/* Supplier Categories */}
      <SupplierCategoriesSection tenantId={id} allCategories={allCategories} assignedCategoryIds={assignedCategoryIds} />
      </div>

      {/* Org Units */}
      <div id="section-org">
      <OrgUnitsSection tenantId={id} orgUnits={orgUnits} />

      {/* Job Descriptions */}
      <JobDescriptionsSection
        tenantId={id}
        jobDescriptions={jobDescriptions}
        orgUnits={orgUnits}
        supplierCategories={allCategories.filter(c => assignedCategoryIds.includes(c.id))}
      />

      </div>

      {/* Career Ladders */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4 mt-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Career Ladders</p>
          <Link
            href="/dashboard/career-ladders/new"
            className="text-[12px] font-semibold text-[#007AFF] hover:opacity-70 transition-opacity"
          >
            + Add Ladder
          </Link>
        </div>
        {tenantLadders.length === 0 ? (
          <p className="text-[13px] text-[#8E8E93]">
            No career ladders yet. Generate a test client or{' '}
            <Link href="/dashboard/career-ladders/new" className="text-[#007AFF] hover:underline">create one manually</Link>.
          </p>
        ) : (
          <div className="space-y-2">
            {tenantLadders.map(l => (
              <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-[#F2F2F7] last:border-0">
                <div>
                  <p className="text-[13px] font-medium text-black">{l.name}</p>
                  {l.industry && <p className="text-[11px] text-[#8E8E93]">{l.industry}</p>}
                </div>
                <Link href={`/dashboard/career-ladders/${l.id}`} className="text-[12px] text-[#007AFF] hover:underline">
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Rule Overrides */}
      {complianceRules.length > 0 && (
        <div id="section-compliance" className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Compliance Rules</p>
            <Link href="/dashboard/settings/compliance-rules" className="text-[12px] text-[#007AFF] hover:underline">Manage platform rules →</Link>
          </div>
          <p className="text-[13px] text-[#8E8E93] mb-4">Override platform-level compliance rules for this tenant. Leave fields blank to inherit the platform default.</p>
          <div className="space-y-3">
            {complianceRules.map(rule => {
              const ov = complianceOverrides[rule.id];
              const hasOverride = !!ov;
              const severityColor = (s: string) => s === 'error' ? '#FF3B30' : s === 'warning' ? '#FF9500' : '#007AFF';
              return (
                <div key={rule.id} className={`border rounded-xl p-4 ${hasOverride ? 'border-[#007AFF]/30 bg-[#E8F4FD]/20' : 'border-[#E5E5EA]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-black">{rule.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: severityColor(ov?.severity_override ?? rule.severity) + '18', color: severityColor(ov?.severity_override ?? rule.severity) }}>
                          {(ov?.severity_override ?? rule.severity).toUpperCase()}
                        </span>
                        {hasOverride && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E8F4FD] text-[#007AFF]">OVERRIDDEN</span>}
                      </div>
                      {rule.description && <p className="text-[11px] text-[#8E8E93] mt-0.5">{rule.description}</p>}
                    </div>
                    {hasOverride && (
                      <form action={async () => {
                        'use server';
                        await resetTenantRuleOverride(id, rule.id);
                      }}>
                        <button type="submit" className="text-[11px] text-[#FF3B30] hover:underline whitespace-nowrap">Reset</button>
                      </form>
                    )}
                  </div>
                  <form action={async (fd: FormData) => {
                    'use server';
                    const activeRaw = fd.get('active_override') as string;
                    const thresholdRaw = fd.get('threshold_override') as string;
                    const severityRaw = fd.get('severity_override') as string;
                    const overrideAllowedRaw = fd.get('override_allowed_override') as string;
                    const notesRaw = fd.get('notes') as string;
                    await upsertTenantRuleOverride(id, rule.id, {
                      active_override:             activeRaw === '' ? null : activeRaw === 'true',
                      threshold_override:          thresholdRaw === '' ? null : Number(thresholdRaw),
                      severity_override:           severityRaw === '' ? null : severityRaw,
                      override_allowed_override:   overrideAllowedRaw === '' ? null : overrideAllowedRaw === 'true',
                      notes:                       notesRaw === '' ? null : notesRaw,
                    });
                  }} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-[#8E8E93] block mb-0.5">Active</label>
                      <select name="active_override" defaultValue={ov?.active_override == null ? '' : ov.active_override ? 'true' : 'false'}
                        className="w-full bg-[#F2F2F7] rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-[#007AFF]/30">
                        <option value="">Inherit ({rule.active ? 'Active' : 'Inactive'})</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#8E8E93] block mb-0.5">Severity</label>
                      <select name="severity_override" defaultValue={ov?.severity_override ?? ''}
                        className="w-full bg-[#F2F2F7] rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-[#007AFF]/30">
                        <option value="">Inherit ({rule.severity})</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error (Hard Stop)</option>
                      </select>
                    </div>
                    {rule.threshold != null && (
                      <div>
                        <label className="text-[11px] text-[#8E8E93] block mb-0.5">Threshold (inherit: {rule.threshold})</label>
                        <input name="threshold_override" type="number" step="0.01"
                          defaultValue={ov?.threshold_override ?? ''}
                          placeholder={`Default: ${rule.threshold}`}
                          className="w-full bg-[#F2F2F7] rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-[#007AFF]/30" />
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] text-[#8E8E93] block mb-0.5">Override Allowed</label>
                      <select name="override_allowed_override" defaultValue={ov?.override_allowed_override == null ? '' : ov.override_allowed_override ? 'true' : 'false'}
                        className="w-full bg-[#F2F2F7] rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-[#007AFF]/30">
                        <option value="">Inherit ({rule.override_allowed ? 'Yes' : 'No'})</option>
                        <option value="true">Yes</option>
                        <option value="false">No (Hard Block)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] text-[#8E8E93] block mb-0.5">Notes</label>
                      <input name="notes" type="text" defaultValue={ov?.notes ?? ''}
                        placeholder="Reason for override…"
                        className="w-full bg-[#F2F2F7] rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-[#007AFF]/30" />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <button type="submit"
                        className="px-3 py-1.5 bg-[#007AFF] text-white text-[12px] font-semibold rounded-lg hover:bg-[#0066DD] transition-colors">
                        Save Override
                      </button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WFX-023: User management */}
      <div id="section-users">
      <UsersSection tenantId={id} users={tenantUsers} orgUnits={orgUnits.map(u => ({ id: u.id, name: u.name }))} />
      </div>

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
