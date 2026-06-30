import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { generateHappySteps, generateUnhappySteps } from '@/lib/workflow/scenarios';
import { getScenarioRuns } from '@/lib/actions/scenario-runs';
import { RunScenarioButton } from './run-button-client';
import { OptimizationPanelClient } from './optimization-panel-client';
import { FailedStepFixButton } from './failed-step-fix-button';
import type { ScenarioRunRecord, StepResult, OptimizationIdea } from '@/lib/workflow/scenarios';
import type { TenantConfig } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function TestScenariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') redirect('/dashboard');

  const admin = createAdminClient();
  const [{ data: tenants }, { data: configs }] = await Promise.all([
    admin.from('tenants').select('id, name, active').order('name'),
    admin.from('tenant_configs').select('*'),
  ]);

  const configMap = Object.fromEntries(
    ((configs ?? []) as TenantConfig[]).map(c => [c.tenant_id, c]),
  );

  // Load last 5 runs per tenant
  const allTenants = ((tenants ?? []) as { id: string; name: string; active: boolean }[])
    .filter(t => configMap[t.id]);

  const runsByTenant: Record<string, ScenarioRunRecord[]> = {};
  await Promise.all(
    allTenants.map(async t => {
      runsByTenant[t.id] = await getScenarioRuns(t.id, 5);
    }),
  );

  // Global totals from latest runs
  const latestRuns = allTenants.map(t => runsByTenant[t.id]?.[0]).filter(Boolean) as ScenarioRunRecord[];
  const totalHappyPass = latestRuns.reduce((a, r) => a + r.happy_pass, 0);
  const totalHappyFail = latestRuns.reduce((a, r) => a + r.happy_fail, 0);
  const totalUnhappyPass = latestRuns.reduce((a, r) => a + r.unhappy_pass, 0);
  const totalUnhappyFail = latestRuns.reduce((a, r) => a + r.unhappy_fail, 0);
  const neverRun = allTenants.filter(t => !runsByTenant[t.id]?.length).length;

  return (
    <div className="px-8 py-10 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px]" style={{ backgroundColor: '#5856D618' }}>
          🧪
        </div>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-black">Workflow Test Scenarios</h1>
          <p className="text-[13px] text-[#8E8E93]">
            Happy + unhappy path simulation per client · validates workflow engine + role security
          </p>
        </div>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mt-4">
        <SummaryCard label="Happy Path" pass={totalHappyPass} fail={totalHappyFail} color="#34C759" icon="✓" description="Correct actors, correct flow" />
        <SummaryCard label="Security Checks" pass={totalUnhappyPass} fail={totalUnhappyFail} color="#FF9500" icon="⛔" description="Wrong role + wrong status blocked" />
        <div className="bg-white rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Clients</p>
          <p className="text-[22px] font-bold text-black mt-1">{allTenants.length}</p>
          <p className="text-[11px] text-[#8E8E93]">{neverRun > 0 ? `${neverRun} never run` : 'all have runs'}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Total Steps</p>
          <p className="text-[22px] font-bold text-black mt-1">{latestRuns.reduce((a, r) => a + r.total_steps, 0)}</p>
          <p className="text-[11px] text-[#8E8E93]">across all latest runs</p>
        </div>
      </div>

      {/* Per-tenant cards */}
      <div className="space-y-6">
        {allTenants.map(tenant => {
          const cfg = configMap[tenant.id] as TenantConfig;
          const runs = runsByTenant[tenant.id] ?? [];
          const latest = runs[0];
          const previous = runs[1];

          // Preview: show step counts from config (no run needed)
          const happySteps = generateHappySteps(cfg as unknown as Parameters<typeof generateHappySteps>[0]);
          const unhappySteps = generateUnhappySteps(cfg as unknown as Parameters<typeof generateHappySteps>[0]);

          return (
            <div key={tenant.id} className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden">
              {/* Card header */}
              <div className="px-5 pt-4 pb-3 border-b border-[#F2F2F7]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[15px] font-bold text-black">{tenant.name}</h2>
                      {latest ? (
                        <StatusBadge pass={latest.happy_pass + latest.unhappy_pass} fail={latest.happy_fail + latest.unhappy_fail} />
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-[#8E8E93]" style={{ backgroundColor: '#F2F2F7' }}>Never run</span>
                      )}
                      {previous && (
                        <DeltaBadge current={latest!} previous={previous} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <ConfigChip label="MSP Review" active={cfg.demand_msp_review} />
                      <ConfigChip label={`Demand Appr. L${cfg.demand_approval_levels}`} active={cfg.demand_approval_levels > 0} />
                      <ConfigChip label="MSP Screening" active={cfg.demand_msp_screening} />
                      <ConfigChip label={`Award Appr. L${cfg.award_approval_levels}`} active={cfg.award_approval_levels > 0} />
                      <ConfigChip label="PO Step" active={cfg.award_po_step} />
                    </div>
                    <p className="text-[10px] text-[#8E8E93] mt-1.5">
                      {happySteps.length} happy steps · {unhappySteps.length} security checks · {happySteps.length + unhappySteps.length} total
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <RunScenarioButton tenantId={tenant.id} tenantName={tenant.name} compact />
                  </div>
                </div>
              </div>

              {/* Latest run results */}
              {latest ? (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-[#8E8E93]">Latest run</span>
                    <span className="text-[11px] text-[#C7C7CC]">{new Date(latest.run_at).toLocaleString('de-DE')}</span>
                    {latest.created_by_name && (
                      <span className="text-[11px] text-[#C7C7CC]">by {latest.created_by_name}</span>
                    )}
                  </div>

                  {/* Happy path results */}
                  <StepSection
                    title="Happy Path"
                    color="#34C759"
                    tenantName={tenant.name}
                    results={(latest.step_results as unknown as StepResult[]).filter(
                      r => r.step.pathType === 'happy' || r.step.pathType === 'operational',
                    )}
                  />

                  {/* Unhappy path results */}
                  <StepSection
                    title="Security Checks (Wrong Role + Wrong Status)"
                    color="#FF9500"
                    tenantName={tenant.name}
                    results={(latest.step_results as unknown as StepResult[]).filter(
                      r => r.step.pathType === 'unhappy_wrong_role' || r.step.pathType === 'unhappy_wrong_status',
                    )}
                    collapsed
                  />

                  {/* Optimization ideas */}
                  {latest.optimization_ideas && (latest.optimization_ideas as unknown as OptimizationIdea[]).length > 0 && (
                    <OptimizationPanelClient
                      ideas={latest.optimization_ideas as unknown as OptimizationIdea[]}
                      tenantName={tenant.name}
                    />
                  )}
                </div>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-[13px] text-[#8E8E93] mb-3">No runs yet — click Run Tests to simulate this client&apos;s workflow</p>
                  <RunScenarioButton tenantId={tenant.id} tenantName={tenant.name} />
                </div>
              )}

              {/* Run history */}
              {runs.length > 1 && (
                <div className="px-5 pb-4 border-t border-[#F2F2F7]">
                  <p className="text-[10px] font-semibold text-[#C7C7CC] uppercase tracking-[0.8px] mt-3 mb-2">Run History</p>
                  <div className="space-y-1.5">
                    {runs.map((run, i) => (
                      <RunHistoryRow key={run.id} run={run} isLatest={i === 0} prev={runs[i + 1]} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ label, pass, fail, color, icon, description }: {
  label: string; pass: number; fail: number; color: string; icon: string; description: string;
}) {
  const total = pass + fail;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <p className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">{icon} {label}</p>
      <p className="text-[22px] font-bold mt-1" style={{ color: fail === 0 ? color : '#FF3B30' }}>
        {pass}/{total}
      </p>
      <p className="text-[11px] text-[#8E8E93]">{fail === 0 ? 'all passed' : `${fail} failed`}</p>
      <p className="text-[10px] text-[#C7C7CC] mt-0.5">{description}</p>
    </div>
  );
}

function StatusBadge({ pass, fail }: { pass: number; fail: number }) {
  const all = pass + fail;
  if (all === 0) return null;
  return (
    <span
      className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: fail === 0 ? '#34C759' : '#FF3B30' }}
    >
      {fail === 0 ? `✓ ${pass}/${all}` : `⚠ ${fail} failed`}
    </span>
  );
}

function DeltaBadge({ current, previous }: { current: ScenarioRunRecord; previous: ScenarioRunRecord }) {
  const curFail = current.happy_fail + current.unhappy_fail;
  const prevFail = previous.happy_fail + previous.unhappy_fail;
  const delta = curFail - prevFail;
  if (delta === 0) return <span className="text-[10px] text-[#8E8E93]">no change</span>;
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: delta < 0 ? '#34C75918' : '#FF3B3018',
        color: delta < 0 ? '#34C759' : '#FF3B30',
      }}
    >
      {delta < 0 ? `▼ ${Math.abs(delta)} fixed` : `▲ ${delta} new issues`}
    </span>
  );
}

function ConfigChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: active ? '#007AFF18' : '#8E8E9314',
        color: active ? '#007AFF' : '#8E8E93',
      }}
    >
      {label}
    </span>
  );
}

function StepSection({
  title, color, results, collapsed = false, tenantName,
}: {
  title: string; color: string; results: StepResult[]; collapsed?: boolean; tenantName: string;
}) {
  const pass = results.filter(r => r.correct).length;
  const fail = results.filter(r => !r.correct).length;
  if (results.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[11px] font-semibold" style={{ color }}>{title}</p>
        <span className="text-[10px] text-[#8E8E93]">{pass}/{results.length} correct</span>
        {fail > 0 && <span className="text-[10px] font-semibold text-[#FF3B30]">⚠ {fail} issues</span>}
      </div>
      <div className="space-y-1">
        {results
          .filter(r => !collapsed || !r.correct)
          .map(result => (
            <StepRow key={result.step.id} result={result} tenantName={tenantName} />
          ))}
        {collapsed && results.filter(r => r.correct).length > 0 && (
          <p className="text-[10px] text-[#C7C7CC] pl-6">
            + {results.filter(r => r.correct).length} checks passed (hidden)
          </p>
        )}
      </div>
    </div>
  );
}

function StepRow({ result, tenantName }: { result: StepResult; tenantName: string }) {
  const { step, testUser, correct, error } = result;
  const iconColor = correct ? '#34C759' : '#FF3B30';

  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-[11px] font-bold flex-shrink-0 mt-0.5 w-8" style={{ color: iconColor }}>
        {correct ? '✓' : '✗'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-semibold text-black">{step.name}</span>
          {step.pathType !== 'operational' && (
            <span className="text-[10px] text-[#8E8E93]">→ {step.toStatus?.replace(/_/g, ' ')}</span>
          )}
          {step.conditionalFlag && (
            <span className="text-[9px] font-mono text-[#007AFF] bg-[#007AFF10] px-1 py-0.5 rounded">{step.conditionalFlag}</span>
          )}
        </div>
        {testUser && (
          <p className="text-[10px] text-[#8E8E93]">
            Tested as: <span className="font-semibold text-black">{testUser.name}</span>
            <span className="text-[#C7C7CC]"> ({testUser.role} · {testUser.email})</span>
          </p>
        )}
        {error && <p className="text-[11px] text-[#FF3B30] font-mono mt-0.5">⚠ {error}</p>}
        {!correct && (
          <FailedStepFixButton step={step} error={error} tenantName={tenantName} />
        )}
      </div>
      <span className="text-[10px] text-[#C7C7CC] flex-shrink-0">{toTitle(step.testRole)}</span>
    </div>
  );
}

function RunHistoryRow({ run, isLatest, prev }: { run: ScenarioRunRecord; isLatest: boolean; prev?: ScenarioRunRecord }) {
  const fail = run.happy_fail + run.unhappy_fail;
  const pass = run.happy_pass + run.unhappy_pass;
  const prevFail = prev ? prev.happy_fail + prev.unhappy_fail : null;
  const delta = prevFail !== null ? fail - prevFail : null;

  return (
    <div className="flex items-center gap-3 py-1 border-b border-[#F2F2F7] last:border-0">
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: fail === 0 ? '#34C759' : '#FF3B30' }} />
      <span className="text-[11px] text-[#8E8E93] flex-shrink-0">
        {new Date(run.run_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
      </span>
      <span className="text-[11px] font-semibold" style={{ color: fail === 0 ? '#34C759' : '#FF3B30' }}>
        {pass}/{run.total_steps} passed
      </span>
      {delta !== null && delta !== 0 && (
        <span className="text-[10px]" style={{ color: delta < 0 ? '#34C759' : '#FF3B30' }}>
          {delta < 0 ? `▼ ${Math.abs(delta)} fixed` : `▲ ${delta} regressed`}
        </span>
      )}
      {isLatest && <span className="text-[9px] font-semibold text-[#007AFF] bg-[#007AFF12] px-1.5 py-0.5 rounded-full">LATEST</span>}
      {run.created_by_name && <span className="text-[10px] text-[#C7C7CC] flex-1 text-right truncate">by {run.created_by_name}</span>}
    </div>
  );
}

function toTitle(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
