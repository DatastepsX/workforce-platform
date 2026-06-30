'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) throw new Error('Forbidden');
  return { supabase, user, role: profile!.role, tenantId: profile!.tenant_id };
}

// ─── Org Units ────────────────────────────────────────────────────────────────

export async function upsertOrgUnit(formData: FormData) {
  const { role, tenantId } = await assertAdmin();
  const id = formData.get('id') as string | null;
  const tenantIdValue = (formData.get('tenant_id') as string) || tenantId;
  if (!tenantIdValue) throw new Error('No tenant');
  if (role !== 'super_admin' && tenantIdValue !== tenantId) throw new Error('Forbidden');

  const admin = createAdminClient();
  const payload = {
    tenant_id:   tenantIdValue,
    name:        (formData.get('name') as string).trim(),
    description: (formData.get('description') as string) || null,
    active:      formData.get('active') !== 'false',
    position:    Number(formData.get('position') ?? 0),
  };

  if (id) {
    await admin.from('org_units').update(payload).eq('id', id);
  } else {
    await admin.from('org_units').insert(payload);
  }
  revalidatePath(`/dashboard/settings/tenants/${tenantIdValue}`);
}

export async function deleteOrgUnit(id: string, tenantId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from('org_units').delete().eq('id', id);
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
}

// ─── Job Descriptions ─────────────────────────────────────────────────────────

export async function upsertJobDescription(formData: FormData) {
  const { role, tenantId } = await assertAdmin();
  const id = formData.get('id') as string | null;
  const tenantIdValue = (formData.get('tenant_id') as string) || tenantId;
  if (!tenantIdValue) throw new Error('No tenant');
  if (role !== 'super_admin' && tenantIdValue !== tenantId) throw new Error('Forbidden');

  const split = (key: string) =>
    (formData.get(key) as string ?? '').split(',').map(s => s.trim()).filter(Boolean);

  const admin = createAdminClient();
  const payload = {
    tenant_id:        tenantIdValue,
    org_unit_id:      (formData.get('org_unit_id') as string) || null,
    title:            (formData.get('title') as string).trim(),
    description:      (formData.get('description') as string) || null,
    skills:           split('skills'),
    contract_type:    (formData.get('contract_type') as string) || null,
    budget_min:       formData.get('budget_min') ? Number(formData.get('budget_min')) : null,
    budget_max:       formData.get('budget_max') ? Number(formData.get('budget_max')) : null,
    experience_years: formData.get('experience_years') ? Number(formData.get('experience_years')) : null,
    seniority_level:  (formData.get('seniority_level') as string) || null,
    location:         (formData.get('location') as string) || null,
    remote_allowed:   formData.get('remote_allowed') === 'true',
    languages:        split('languages'),
    active:           formData.get('active') !== 'false',
  };

  let jdId = id;
  if (id) {
    await admin.from('job_descriptions').update(payload).eq('id', id);
  } else {
    const { data } = await admin.from('job_descriptions').insert(payload).select('id').single();
    jdId = data?.id ?? null;
  }

  // Update supplier category links
  if (jdId) {
    const categoryIds = (formData.get('supplier_category_ids') as string ?? '')
      .split(',').map(s => s.trim()).filter(Boolean);
    await admin.from('jd_supplier_categories').delete().eq('job_description_id', jdId);
    if (categoryIds.length > 0) {
      await admin.from('jd_supplier_categories').insert(
        categoryIds.map(scId => ({ job_description_id: jdId, supplier_category_id: scId }))
      );
    }
  }

  revalidatePath(`/dashboard/settings/tenants/${tenantIdValue}`);
}

export async function deleteJobDescription(id: string, tenantId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from('job_descriptions').delete().eq('id', id);
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
}

// ─── Supplier Categories (global) ─────────────────────────────────────────────

export async function upsertSupplierCategory(formData: FormData) {
  await assertAdmin();
  const id = formData.get('id') as string | null;
  const admin = createAdminClient();
  const payload = {
    name:        (formData.get('name') as string).trim(),
    description: (formData.get('description') as string) || null,
    active:      formData.get('active') !== 'false',
  };
  if (id) {
    await admin.from('supplier_categories').update(payload).eq('id', id);
  } else {
    await admin.from('supplier_categories').insert(payload);
  }
  revalidatePath('/dashboard/settings/supplier-categories');
}

export async function deleteSupplierCategory(id: string) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from('supplier_categories').delete().eq('id', id);
  revalidatePath('/dashboard/settings/supplier-categories');
}

export async function toggleSupplierCategoryMember(supplierId: string, categoryId: string, add: boolean) {
  await assertAdmin();
  const admin = createAdminClient();
  if (add) {
    await admin.from('supplier_category_members').upsert({ supplier_id: supplierId, supplier_category_id: categoryId });
  } else {
    await admin.from('supplier_category_members').delete()
      .eq('supplier_id', supplierId).eq('supplier_category_id', categoryId);
  }
  revalidatePath('/dashboard/settings/supplier-categories');
}

// ─── Tenant ↔ Supplier Category assignment ───────────────────────────────────

export async function toggleTenantSupplierCategory(tenantId: string, categoryId: string, add: boolean) {
  await assertAdmin();
  const admin = createAdminClient();
  if (add) {
    await admin.from('tenant_supplier_categories').upsert({ tenant_id: tenantId, supplier_category_id: categoryId });
  } else {
    await admin.from('tenant_supplier_categories').delete()
      .eq('tenant_id', tenantId).eq('supplier_category_id', categoryId);
  }
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
}

// ─── User → Org Unit assignment ───────────────────────────────────────────────

export async function assignUserOrgUnit(userId: string, orgUnitId: string | null, tenantId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from('profiles').update({ org_unit_id: orgUnitId }).eq('id', userId);
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
}

// ─── Update tenant user (full_name + role + org_unit_id) ─────────────────────

export async function updateTenantUser(
  userId: string,
  updates: { full_name?: string; role?: string; org_unit_id?: string | null },
  tenantId: string,
) {
  await assertAdmin();
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {};
  if (updates.full_name !== undefined) payload.full_name = updates.full_name || null;
  if (updates.role !== undefined) payload.role = updates.role;
  if ('org_unit_id' in updates) payload.org_unit_id = updates.org_unit_id ?? null;
  if (Object.keys(payload).length > 0) {
    await admin.from('profiles').update(payload).eq('id', userId);
  }
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
}
