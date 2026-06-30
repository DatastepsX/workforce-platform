'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ComplianceRule, ValidationResult } from '@/types/database';

const adminDb = createAdminClient();

async function getRole(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  const { data } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  return data?.role ?? '';
}

async function getUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');
  return user.id;
}

// ── Compliance Rules ──────────────────────────────────────────────────────────

export async function listComplianceRules(filters?: {
  country?: string;
  contractType?: string;
  severity?: string;
  activeOnly?: boolean;
}): Promise<ComplianceRule[]> {
  let q = adminDb.from('compliance_rules').select('*').order('country', { nullsFirst: true }).order('name');

  if (filters?.country)      q = q.eq('country', filters.country);
  if (filters?.contractType) q = q.eq('contract_type', filters.contractType);
  if (filters?.severity)     q = q.eq('severity', filters.severity);
  if (filters?.activeOnly)   q = q.eq('active', true);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getComplianceRule(id: string): Promise<ComplianceRule | null> {
  const { data, error } = await adminDb.from('compliance_rules').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function createComplianceRule(formData: FormData): Promise<void> {
  const role = await getRole();
  if (role !== 'super_admin') throw new Error('Forbidden');

  const { error } = await adminDb.from('compliance_rules').insert({
    name:             formData.get('name') as string,
    description:      formData.get('description') as string || null,
    country:          formData.get('country') as string || null,
    contract_type:    formData.get('contract_type') as string || null,
    cost_item_id:     formData.get('cost_item_id') as string || null,
    effective_from:   formData.get('effective_from') as string || null,
    effective_to:     formData.get('effective_to') as string || null,
    severity:         formData.get('severity') as string || 'warning',
    threshold:        formData.get('threshold') ? Number(formData.get('threshold')) : null,
    threshold_unit:   formData.get('threshold_unit') as string || null,
    validation_logic: formData.get('validation_logic') as string,
    override_allowed: formData.get('override_allowed') === 'true',
    active:           formData.get('active') !== 'false',
  });

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/settings/compliance-rules');
}

export async function updateComplianceRule(id: string, formData: FormData): Promise<void> {
  const role = await getRole();
  if (role !== 'super_admin') throw new Error('Forbidden');

  const { error } = await adminDb.from('compliance_rules').update({
    name:             formData.get('name') as string,
    description:      formData.get('description') as string || null,
    country:          formData.get('country') as string || null,
    contract_type:    formData.get('contract_type') as string || null,
    cost_item_id:     formData.get('cost_item_id') as string || null,
    effective_from:   formData.get('effective_from') as string || null,
    effective_to:     formData.get('effective_to') as string || null,
    severity:         formData.get('severity') as string || 'warning',
    threshold:        formData.get('threshold') ? Number(formData.get('threshold')) : null,
    threshold_unit:   formData.get('threshold_unit') as string || null,
    validation_logic: formData.get('validation_logic') as string,
    override_allowed: formData.get('override_allowed') === 'true',
    active:           formData.get('active') !== 'false',
  }).eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/settings/compliance-rules');
  revalidatePath(`/dashboard/settings/compliance-rules/${id}`);
}

export async function deleteComplianceRule(id: string): Promise<void> {
  const role = await getRole();
  if (role !== 'super_admin') throw new Error('Forbidden');
  await adminDb.from('compliance_rules').delete().eq('id', id);
  revalidatePath('/dashboard/settings/compliance-rules');
}

// ── Validation Engine ─────────────────────────────────────────────────────────

export interface ValidationContext {
  entityType: string;
  entityId: string;
  contractType?: string;
  country?: string;
  tenantId?: string;
  values: Record<string, number | string | boolean | null>;
}

export interface ValidationFinding {
  rule: ComplianceRule;
  result: ValidationResult;
  message: string;
}

export async function validateEntity(ctx: ValidationContext): Promise<ValidationFinding[]> {
  const { contractType, country, values } = ctx;

  // Fetch applicable rules
  const rules = await listComplianceRules({ activeOnly: true });
  const applicable = rules.filter(r => {
    if (r.contract_type && r.contract_type !== contractType) return false;
    if (r.country && r.country !== country) return false;
    // Effective date check
    const now = new Date();
    if (r.effective_from && new Date(r.effective_from) > now) return false;
    if (r.effective_to && new Date(r.effective_to) < now) return false;
    return true;
  });

  const findings: ValidationFinding[] = [];

  for (const rule of applicable) {
    const finding = evaluateRule(rule, values);
    if (finding) findings.push({ rule, ...finding });
  }

  return findings;
}

function evaluateRule(
  rule: ComplianceRule,
  values: Record<string, number | string | boolean | null>
): { result: ValidationResult; message: string } | null {
  const t = rule.threshold;
  const logic = rule.validation_logic;

  switch (logic) {
    case 'max_daily_hours': {
      const v = Number(values.daily_hours ?? 0);
      if (t !== null && v > t) return { result: rule.severity === 'error' ? 'failed' : 'warning', message: `Daily hours (${v}h) exceed the maximum of ${t}h.` };
      break;
    }
    case 'max_weekly_hours': {
      const v = Number(values.weekly_hours ?? 0);
      if (t !== null && v > t) return { result: rule.severity === 'error' ? 'failed' : 'warning', message: `Weekly hours (${v}h) exceed the limit of ${t}h.` };
      break;
    }
    case 'min_rest_period': {
      const v = Number(values.rest_hours ?? 99);
      if (t !== null && v < t) return { result: 'failed', message: `Rest period (${v}h) is below the required minimum of ${t}h.` };
      break;
    }
    case 'min_wage_hourly': {
      const v = Number(values.hourly_rate ?? 0);
      if (t !== null && v < t) return { result: 'failed', message: `Effective rate (€${v}/h) is below the statutory minimum wage of €${t}/h.` };
      break;
    }
    case 'aug_equal_pay': {
      const months = Number(values.assignment_months ?? 0);
      if (t !== null && months >= t) return { result: 'warning', message: `Assignment is ${months} months long — equal pay applies under AÜG §8 after ${t} months.` };
      break;
    }
    case 'aug_max_duration': {
      const months = Number(values.assignment_months ?? 0);
      if (t !== null && months > t) return { result: 'failed', message: `Assignment duration (${months} months) exceeds AÜG maximum of ${t} months.` };
      break;
    }
    case 'aug_tariff_required': {
      if (!values.tariff_agreement) return { result: 'failed', message: 'A BAP/iGZ tariff agreement must be in place for AÜG-compliant temp staffing.' };
      break;
    }
    case 'ir35_status': {
      if (!values.ir35_determined) return { result: 'failed', message: 'IR35 status determination is required before the contractor engagement begins.' };
      break;
    }
    case 'scheinselbst_status': {
      if (!values.scheinselbst_assessed) return { result: 'failed', message: 'Scheinselbstständigkeit (§611a BGB) assessment is required.' };
      break;
    }
    case 'max_per_diem': {
      const v = Number(values.per_diem ?? 0);
      if (t !== null && v > t) return { result: 'warning', message: `Per diem (€${v}) exceeds the approved cap of €${t}.` };
      break;
    }
    case 'max_mileage_rate': {
      const v = Number(values.mileage_rate ?? 0);
      if (t !== null && v > t) return { result: 'warning', message: `Mileage rate (€${v}/km) exceeds the approved cap of €${t}/km.` };
      break;
    }
    case 'receipt_required': {
      const v = Number(values.expense_amount ?? 0);
      if (t !== null && v > t && !values.has_receipt) return { result: 'warning', message: `Expense of €${v} requires a receipt (threshold: €${t}).` };
      break;
    }
    case 'minor_worker_hours': {
      if (values.is_minor) {
        const v = Number(values.daily_hours ?? 0);
        if (t !== null && v > t) return { result: 'failed', message: `Minor worker hours (${v}h/day) exceed the legal maximum of ${t}h.` };
      }
      break;
    }
    case 'sunday_restriction':
    case 'public_holiday':
    case 'maternity_protection':
    case 'vat_treatment':
      return { result: 'warning', message: `${rule.name}: manual verification required.` };
    default:
      return null;
  }
  return null;
}

// ── Validation Log ────────────────────────────────────────────────────────────

export async function logValidationResult(params: {
  ruleId: string | null;
  ruleSnapshot: ComplianceRule | null;
  entityType: string;
  entityId: string | null;
  result: ValidationResult;
  overrideDecision?: boolean;
  overrideReason?: string;
  finalOutcome?: 'approved' | 'rejected' | 'pending';
}): Promise<void> {
  const userId = await getUserId();
  await adminDb.from('compliance_validation_logs').insert({
    rule_id:          params.ruleId,
    rule_snapshot:    params.ruleSnapshot as unknown as Record<string, unknown>,
    entity_type:      params.entityType,
    entity_id:        params.entityId,
    validation_result: params.result,
    override_decision: params.overrideDecision ?? false,
    override_reason:   params.overrideReason ?? null,
    validated_by:      userId,
    final_outcome:     params.finalOutcome ?? 'pending',
  });
}

// ── Per-tenant rule overrides ─────────────────────────────────────────────────

export async function listTenantRuleOverrides(tenantId: string): Promise<Record<string, {
  active_override: boolean | null;
  threshold_override: number | null;
  severity_override: string | null;
  override_allowed_override: boolean | null;
  notes: string | null;
}>> {
  const { data } = await adminDb
    .from('tenant_compliance_rule_overrides')
    .select('rule_id, active_override, threshold_override, severity_override, override_allowed_override, notes')
    .eq('tenant_id', tenantId);
  const map: Record<string, {
    active_override: boolean | null;
    threshold_override: number | null;
    severity_override: string | null;
    override_allowed_override: boolean | null;
    notes: string | null;
  }> = {};
  for (const row of data ?? []) {
    map[row.rule_id] = {
      active_override: row.active_override,
      threshold_override: row.threshold_override,
      severity_override: row.severity_override,
      override_allowed_override: row.override_allowed_override,
      notes: row.notes,
    };
  }
  return map;
}

export async function upsertTenantRuleOverride(
  tenantId: string,
  ruleId: string,
  overrides: {
    active_override?: boolean | null;
    threshold_override?: number | null;
    severity_override?: string | null;
    override_allowed_override?: boolean | null;
    notes?: string | null;
  }
): Promise<void> {
  const role = await getRole();
  if (!['super_admin', 'admin'].includes(role)) throw new Error('Forbidden');
  const userId = await getUserId();

  await adminDb.from('tenant_compliance_rule_overrides').upsert({
    tenant_id: tenantId,
    rule_id: ruleId,
    ...overrides,
    updated_by: userId,
  }, { onConflict: 'tenant_id,rule_id' });

  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
}

export async function resetTenantRuleOverride(tenantId: string, ruleId: string): Promise<void> {
  const role = await getRole();
  if (!['super_admin', 'admin'].includes(role)) throw new Error('Forbidden');
  await adminDb
    .from('tenant_compliance_rule_overrides')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('rule_id', ruleId);
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
}
