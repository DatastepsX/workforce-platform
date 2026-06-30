'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { CostItem, CostItemCategory, CostItemContractType } from '@/types/database';

const adminDb = createAdminClient();

async function getRole(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  const { data } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  return data?.role ?? '';
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCostItemCategories(): Promise<CostItemCategory[]> {
  const { data, error } = await adminDb
    .from('cost_item_categories')
    .select('*')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Cost Items ────────────────────────────────────────────────────────────────

export interface CostItemWithMeta extends CostItem {
  category: CostItemCategory | null;
  contract_types: CostItemContractType[];
}

export async function listCostItems(contractType?: CostItemContractType): Promise<CostItemWithMeta[]> {
  // Fetch all cost items with their categories
  let q = adminDb
    .from('cost_items')
    .select('*, category:cost_item_categories(*)')
    .order('code');

  if (contractType) {
    // Filter by contract type via subquery
    const { data: ctIds } = await adminDb
      .from('cost_item_contract_types')
      .select('cost_item_id')
      .eq('contract_type', contractType);
    const ids = (ctIds ?? []).map((r: { cost_item_id: string }) => r.cost_item_id);
    if (ids.length === 0) return [];
    q = q.in('id', ids);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const items = data ?? [];

  // Fetch contract types for all items
  const allIds = items.map((i: CostItem) => i.id);
  const { data: ctRows } = await adminDb
    .from('cost_item_contract_types')
    .select('cost_item_id, contract_type')
    .in('cost_item_id', allIds.length ? allIds : ['00000000-0000-0000-0000-000000000000']);

  const ctMap: Record<string, CostItemContractType[]> = {};
  for (const row of ctRows ?? []) {
    if (!ctMap[row.cost_item_id]) ctMap[row.cost_item_id] = [];
    ctMap[row.cost_item_id].push(row.contract_type as CostItemContractType);
  }

  return items.map((item: CostItem & { category: CostItemCategory | null }) => ({
    ...item,
    contract_types: ctMap[item.id] ?? [],
  }));
}

export async function getCostItem(id: string): Promise<CostItemWithMeta | null> {
  const { data, error } = await adminDb
    .from('cost_items')
    .select('*, category:cost_item_categories(*)')
    .eq('id', id)
    .single();
  if (error) return null;

  const { data: ctRows } = await adminDb
    .from('cost_item_contract_types')
    .select('contract_type')
    .eq('cost_item_id', id);

  return {
    ...data,
    contract_types: (ctRows ?? []).map((r: { contract_type: string }) => r.contract_type as CostItemContractType),
  };
}

export async function getAvailableCostItems(params: {
  contractType?: string;
  country?: string;
  tenantId?: string;
}): Promise<CostItemWithMeta[]> {
  const { contractType, country, tenantId } = params;

  // Map legacy demand contract_type values to cost item contract types
  const ctMap: Record<string, CostItemContractType> = {
    perm: 'perm', permanent: 'perm',
    temp: 'temp', freelance: 'temp',
    contracting: 'contracting', contractor: 'contracting',
    sow: 'sow',
  };
  const mappedType = contractType ? ctMap[contractType] : undefined;

  let all = await listCostItems(mappedType);

  // Filter by country: items with empty countries array = global; otherwise must include country
  if (country) {
    all = all.filter(i => i.countries.length === 0 || i.countries.includes(country));
  }

  // Filter by tenant: items with no client rows = globally available; client rows restrict to those tenants
  if (tenantId) {
    const { data: clientRows } = await adminDb
      .from('cost_item_clients')
      .select('cost_item_id')
      .eq('tenant_id', tenantId);
    const tenantItemIds = new Set((clientRows ?? []).map((r: { cost_item_id: string }) => r.cost_item_id));

    // Also check which items have ANY client restriction at all
    const { data: allClientRows } = await adminDb
      .from('cost_item_clients')
      .select('cost_item_id');
    const restrictedItemIds = new Set((allClientRows ?? []).map((r: { cost_item_id: string }) => r.cost_item_id));

    all = all.filter(i => !restrictedItemIds.has(i.id) || tenantItemIds.has(i.id));
  }

  return all.filter(i => i.active);
}

export async function createCostItem(formData: FormData): Promise<void> {
  const role = await getRole();
  if (role !== 'super_admin') throw new Error('Forbidden');

  const contractTypes = formData.getAll('contract_types') as CostItemContractType[];
  const countries = (formData.get('countries') as string || '').split(',').map(s => s.trim()).filter(Boolean);

  const { data, error } = await adminDb.from('cost_items').insert({
    code:                 formData.get('code') as string,
    name:                 formData.get('name') as string,
    description:          formData.get('description') as string || null,
    category_id:          formData.get('category_id') as string || null,
    billing_type:         formData.get('billing_type') as string || null,
    markup_eligible:      formData.get('markup_eligible') === 'true',
    pass_through:         formData.get('pass_through') === 'true',
    tax_treatment:        formData.get('tax_treatment') as string || 'standard',
    sap_gl_account:       formData.get('sap_gl_account') as string || null,
    sap_cost_object_type: formData.get('sap_cost_object_type') as string || null,
    countries,
    active:               formData.get('active') !== 'false',
    effective_from:       formData.get('effective_from') as string || null,
    effective_to:         formData.get('effective_to') as string || null,
  }).select('id').single();

  if (error) throw new Error(error.message);

  if (contractTypes.length) {
    await adminDb.from('cost_item_contract_types').insert(
      contractTypes.map(ct => ({ cost_item_id: data.id, contract_type: ct }))
    );
  }

  revalidatePath('/dashboard/settings/cost-items');
}

export async function updateCostItem(id: string, formData: FormData): Promise<void> {
  const role = await getRole();
  if (role !== 'super_admin') throw new Error('Forbidden');

  const contractTypes = formData.getAll('contract_types') as CostItemContractType[];
  const countries = (formData.get('countries') as string || '').split(',').map(s => s.trim()).filter(Boolean);

  const { error } = await adminDb.from('cost_items').update({
    code:                 formData.get('code') as string,
    name:                 formData.get('name') as string,
    description:          formData.get('description') as string || null,
    category_id:          formData.get('category_id') as string || null,
    billing_type:         formData.get('billing_type') as string || null,
    markup_eligible:      formData.get('markup_eligible') === 'true',
    pass_through:         formData.get('pass_through') === 'true',
    tax_treatment:        formData.get('tax_treatment') as string || 'standard',
    sap_gl_account:       formData.get('sap_gl_account') as string || null,
    sap_cost_object_type: formData.get('sap_cost_object_type') as string || null,
    countries,
    active:               formData.get('active') !== 'false',
    effective_from:       formData.get('effective_from') as string || null,
    effective_to:         formData.get('effective_to') as string || null,
  }).eq('id', id);

  if (error) throw new Error(error.message);

  // Replace contract types
  await adminDb.from('cost_item_contract_types').delete().eq('cost_item_id', id);
  if (contractTypes.length) {
    await adminDb.from('cost_item_contract_types').insert(
      contractTypes.map(ct => ({ cost_item_id: id, contract_type: ct }))
    );
  }

  revalidatePath('/dashboard/settings/cost-items');
  revalidatePath(`/dashboard/settings/cost-items/${id}`);
}

export async function deleteCostItem(id: string): Promise<void> {
  const role = await getRole();
  if (role !== 'super_admin') throw new Error('Forbidden');
  await adminDb.from('cost_items').delete().eq('id', id);
  revalidatePath('/dashboard/settings/cost-items');
}
