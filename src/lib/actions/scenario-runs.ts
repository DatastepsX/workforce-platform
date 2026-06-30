'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';
import { buildFullReport, type TestUser, type OptimizationIdea, type ScenarioRunRecord } from '@/lib/workflow/scenarios';
import type { TenantConfig } from '@/types/database';

export async function runScenarioAction(
  tenantId: string,
): Promise<{ success: boolean; run?: ScenarioRunRecord; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: profile } = await supabase.from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
    return { success: false, error: 'Unauthorised' };
  }

  const admin = createAdminClient();

  // 1. Fetch tenant + config + users
  const [
    { data: tenant },
    { data: config },
    { data: usersData },
  ] = await Promise.all([
    admin.from('tenants').select('id, name').eq('id', tenantId).single(),
    admin.from('tenant_configs').select('*').eq('tenant_id', tenantId).single(),
    admin.from('profiles')
      .select('id, full_name, email, role')
      .eq('tenant_id', tenantId)
      .order('role'),
  ]);

  if (!tenant || !config) {
    return { success: false, error: 'Tenant or config not found' };
  }

  const users: TestUser[] = ((usersData ?? []) as {
    id: string; full_name: string | null; email: string | null; role: string;
  }[]).map(u => ({
    id: u.id,
    name: u.full_name ?? u.email ?? 'Unknown',
    email: u.email ?? '',
    role: u.role,
  }));

  // 2. Run simulation
  const report = buildFullReport(tenantId, tenant.name, config as TenantConfig, users);

  // 3. Generate optimization ideas via Anthropic (best-effort, non-blocking)
  let optimizationIdeas: OptimizationIdea[] | null = null;
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const client = new Anthropic({ apiKey: anthropicKey });
      const configSummary = {
        demand_msp_review: (config as TenantConfig).demand_msp_review,
        demand_approval_levels: (config as TenantConfig).demand_approval_levels,
        demand_approval_roles: [
          (config as TenantConfig).demand_approval_role_l1,
          (config as TenantConfig).demand_approval_role_l2,
          (config as TenantConfig).demand_approval_role_l3,
        ].filter(Boolean),
        demand_msp_screening: (config as TenantConfig).demand_msp_screening,
        award_msp_offer: (config as TenantConfig).award_msp_offer,
        award_approval_levels: (config as TenantConfig).award_approval_levels,
        award_approval_roles: [
          (config as TenantConfig).award_approval_role_l1,
          (config as TenantConfig).award_approval_role_l2,
          (config as TenantConfig).award_approval_role_l3,
        ].filter(Boolean),
        award_po_step: (config as TenantConfig).award_po_step,
      };

      const failures = report.results
        .filter(r => !r.correct)
        .map(r => `${r.step.name}: ${r.error ?? 'unexpected outcome'}`);

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: 'You are an MSP/VMS workforce management expert. Respond ONLY with a valid JSON array. No markdown, no explanations outside the JSON.',
        messages: [{
          role: 'user',
          content: `Analyze this client's workflow configuration and test results. Generate 5 specific, actionable optimization ideas.

Client: ${tenant.name}
Workflow Config: ${JSON.stringify(configSummary, null, 2)}
Test Results: ${report.happyPass}/${report.happyPass + report.happyFail} happy paths passed, ${report.unhappyPass}/${report.unhappyPass + report.unhappyFail} security checks passed.
${failures.length > 0 ? `\nFailed steps:\n${failures.join('\n')}` : ''}

MSP/VMS market trends 2026:
- AI-powered candidate pre-screening reducing time-to-shortlist by 60%
- Skills-based hiring displacing traditional job-title matching
- Real-time dynamic rate benchmarking against market data
- Supplier performance tiering and scorecards
- Digital contracting with e-signature and auto-PO generation
- DEI analytics embedded in screening stage
- Predictive demand forecasting from historical workforce data
- Compliance automation: IR35, worker classification, SOW vs. staff augmentation
- Self-service portals reducing MSP recruiter workload by 40%
- Continuous feedback loops between HM satisfaction and supplier scoring

Return exactly this JSON format:
[
  {
    "title": "Short title (max 8 words)",
    "priority": "high",
    "category": "process",
    "description": "2-3 sentences describing the optimisation and HOW to implement it in this platform.",
    "impact": "Quantified or qualified expected business impact.",
    "requirement": "As a [role], I want to [action] so that [benefit]."
  }
]

Priority: high | medium | low
Category: process | compliance | technology | efficiency | quality`,
        }],
      });

      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
      const parsed = JSON.parse(text.replace(/^```json\n?/, '').replace(/\n?```$/, ''));
      if (Array.isArray(parsed)) {
        optimizationIdeas = parsed.slice(0, 5) as OptimizationIdea[];
      }
    }
  } catch {
    // Optimization ideas are non-blocking — silently skip on error
  }

  // 4. Save to DB
  const runPayload = {
    tenant_id: tenantId,
    tenant_name: tenant.name,
    happy_pass: report.happyPass,
    happy_fail: report.happyFail,
    unhappy_pass: report.unhappyPass,
    unhappy_fail: report.unhappyFail,
    total_steps: report.totalSteps,
    step_results: report.results as unknown as Record<string, unknown>[],
    optimization_ideas: optimizationIdeas as unknown as Record<string, unknown>[] | null,
    triggered_by: 'manual',
    created_by_name: profile?.full_name ?? user.email ?? 'Unknown',
  };

  const { data: saved, error: saveError } = await admin
    .from('scenario_runs')
    .insert(runPayload)
    .select('*')
    .single();

  if (saveError || !saved) {
    return { success: false, error: saveError?.message ?? 'Failed to save run' };
  }

  revalidatePath('/dashboard/dev/test-scenarios');
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);

  return { success: true, run: saved as unknown as ScenarioRunRecord };
}

export async function getScenarioRuns(
  tenantId: string,
  limit = 5,
): Promise<ScenarioRunRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('scenario_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('run_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as ScenarioRunRecord[];
}

export async function getAllLatestRuns(): Promise<ScenarioRunRecord[]> {
  const admin = createAdminClient();
  // Get the latest run per tenant using a subquery pattern
  const { data } = await admin
    .from('scenario_runs')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(100);

  if (!data) return [];

  // Keep only the most recent run per tenant
  const seen = new Set<string>();
  const latest: ScenarioRunRecord[] = [];
  for (const run of data as unknown as ScenarioRunRecord[]) {
    if (!seen.has(run.tenant_id)) {
      seen.add(run.tenant_id);
      latest.push(run);
    }
  }
  return latest;
}
