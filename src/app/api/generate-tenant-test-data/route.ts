import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// ── Types ────────────────────────────────────────────────────────────────────

interface LogFn {
  (msg: string, type?: 'info' | 'success' | 'error' | 'warn'): Promise<void>;
}

interface ScenarioResult {
  demandId: string;
  demandTitle: string;
  submissionId?: string;
  awardId?: string;
  periodsCreated?: number;
  costEntriesCreated?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

// Generate billing periods inline (no auth check needed here)
function generatePeriodRows(
  awardId: string,
  periodType: string,
  startDate: string,
  endDate: string,
): { award_id: string; period_number: number; period_type: string; label: string; start_date: string; end_date: string; status: string }[] {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const rows: { award_id: string; period_number: number; period_type: string; label: string; start_date: string; end_date: string; status: string }[] = [];

  if (periodType === 'weekly') {
    let cur = start.getTime();
    let n = 1;
    while (cur <= end.getTime() && n <= 4) { // cap at 4 for test data
      const pStart = new Date(cur);
      const pEnd   = new Date(Math.min(cur + 6 * 86400000, end.getTime()));
      rows.push({ award_id: awardId, period_number: n, period_type: periodType, label: `Week ${n}`, start_date: isoDate(pStart), end_date: isoDate(pEnd), status: 'open' });
      cur += 7 * 86400000;
      n++;
    }
  } else if (periodType === 'bi_weekly') {
    let cur = start.getTime();
    let n = 1;
    while (cur <= end.getTime() && n <= 3) {
      const pStart = new Date(cur);
      const pEnd   = new Date(Math.min(cur + 13 * 86400000, end.getTime()));
      rows.push({ award_id: awardId, period_number: n, period_type: periodType, label: `Period ${n}`, start_date: isoDate(pStart), end_date: isoDate(pEnd), status: 'open' });
      cur += 14 * 86400000;
      n++;
    }
  } else if (periodType === 'monthly') {
    let yr = start.getFullYear();
    let mo = start.getMonth();
    let n  = 1;
    while (new Date(yr, mo, 1) <= end && n <= 3) {
      const pStart = new Date(yr, mo, 1);
      const pEnd   = new Date(Math.min(new Date(yr, mo + 1, 0).getTime(), end.getTime()));
      const label  = pStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      rows.push({ award_id: awardId, period_number: n, period_type: periodType, label, start_date: isoDate(pStart), end_date: isoDate(pEnd), status: 'open' });
      if (mo === 11) { yr++; mo = 0; } else { mo++; }
      n++;
    }
  } else {
    // milestone / fixed — single period
    rows.push({ award_id: awardId, period_number: 1, period_type: periodType, label: periodType === 'milestone' ? 'Milestone 1' : 'Fixed Fee', start_date: isoDate(start), end_date: isoDate(end), status: 'open' });
  }
  return rows;
}

// ── Core generation ──────────────────────────────────────────────────────────

async function generateTestData(tenantId: string, log: LogFn): Promise<ScenarioResult[]> {
  const admin = createAdminClient();
  const results: ScenarioResult[] = [];

  // ── Fetch tenant context ──────────────────────────────────────────────────
  await log('Fetching tenant context…');
  const { data: adminUser } = await admin
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('role', ['admin', 'recruiter', 'super_admin'])
    .limit(1)
    .single();

  const createdBy: string | null = adminUser?.id ?? null;
  if (!createdBy) {
    await log('No admin/recruiter user found for this tenant — demands will be created without created_by (may fail RLS). Create a user first.', 'warn');
    throw new Error('Tenant has no admin or recruiter user. Generate a test client first.');
  }
  await log(`Using user ${createdBy} as creator`, 'info');

  const { data: tenantSuppliers } = await admin
    .from('tenant_suppliers')
    .select('supplier_id, suppliers(id, company_name)')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .limit(3);

  const supplierIds: string[] = (tenantSuppliers ?? []).map(
    (ts: { supplier_id: string }) => ts.supplier_id
  );
  const firstSupplierId: string | null = supplierIds[0] ?? null;
  const firstSupplierName: string | null = firstSupplierId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ((tenantSuppliers?.[0] as any)?.suppliers?.company_name ?? null)
    : null;
  await log(`Found ${supplierIds.length} active supplier(s) for this tenant`, 'info');

  // Fetch a few cost items to use in entries
  const { data: costItemsData } = await admin
    .from('cost_items')
    .select('id, name')
    .limit(5);
  const costItems = (costItemsData ?? []) as { id: string; name: string }[];
  const firstCostItemId = costItems[0]?.id ?? null;

  const now = new Date();
  const startDate = isoDate(addDays(now, 7));    // starts next week
  const endDate6m = isoDate(addMonths(now, 6));  // 6 months later
  const endDate3m = isoDate(addMonths(now, 3));  // 3 months

  // ── Helper: create demand ────────────────────────────────────────────────
  async function createDemand(opts: {
    title: string;
    status: string;
    contractType: string;
    billingPeriodType?: string;
    skills: string[];
    budgetMin?: number;
    budgetMax?: number;
    description?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<string> {
    const { data, error } = await admin.from('demands').insert({
      title: opts.title,
      description: opts.description ?? `Test scenario demand for ${opts.title}. Generated by E2E test data tool.`,
      status: opts.status,
      contract_type: opts.contractType,
      billing_period_type: opts.billingPeriodType ?? null,
      skills: opts.skills,
      budget_min: opts.budgetMin ?? null,
      budget_max: opts.budgetMax ?? null,
      start_date: opts.startDate ?? startDate,
      end_date: opts.endDate ?? endDate6m,
      priority: 'medium',
      channels: ['suppliers'],
      remote_allowed: true,
      location: 'München, Germany',
      tenant_id: tenantId,
      created_by: createdBy,
    }).select('id').single();
    if (error) throw new Error(`Failed to create demand "${opts.title}": ${error.message}`);
    return (data as { id: string }).id;
  }

  // ── Helper: create submission ────────────────────────────────────────────
  async function createSubmission(opts: {
    demandId: string;
    candidateName: string;
    candidateEmail?: string;
    status: string;
    proposedRate?: number;
    rateType?: string;
  }): Promise<string> {
    const { data, error } = await admin.from('candidate_submissions').insert({
      demand_id:        opts.demandId,
      supplier_id:      firstSupplierId,
      candidate_name:   opts.candidateName,
      candidate_email:  opts.candidateEmail ?? `candidate.${opts.candidateName.toLowerCase().replace(/\s+/g, '.')}@example.de`,
      status:           opts.status,
      source:           firstSupplierId ? 'supplier' : 'direct',
      proposed_rate:    opts.proposedRate ?? null,
      rate_type:        opts.rateType ?? 'daily',
      submitted_at:     new Date().toISOString(),
    }).select('id').single();
    if (error) throw new Error(`Failed to create submission for "${opts.candidateName}": ${error.message}`);
    return (data as { id: string }).id;
  }

  // ── Helper: create award ─────────────────────────────────────────────────
  async function createAward(opts: {
    demandId: string;
    demandTitle: string;
    submissionId?: string;
    candidateName: string;
    status: string;
    rate?: number;
    rateType?: string;
    billingPeriodType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<string> {
    const { data, error } = await admin.from('awards').insert({
      demand_id:           opts.demandId,
      submission_id:       opts.submissionId ?? null,
      supplier_id:         firstSupplierId,
      tenant_id:           tenantId,
      candidate_name:      opts.candidateName,
      candidate_email:     `${opts.candidateName.toLowerCase().replace(/\s+/g, '.')}@example.de`,
      supplier_name:       firstSupplierName,
      demand_title:        opts.demandTitle,
      rate:                opts.rate ?? 120,
      rate_type:           opts.rateType ?? 'daily',
      currency:            'EUR',
      total_amount:        null,
      price_locked:        false,
      start_date:          opts.startDate ?? startDate,
      end_date:            opts.endDate ?? endDate6m,
      billing_period_type: opts.billingPeriodType ?? null,
      status:              opts.status,
      notes:               'Generated by E2E test data tool.',
      created_by:          createdBy,
    }).select('id').single();
    if (error) throw new Error(`Failed to create award for "${opts.candidateName}": ${error.message}`);
    return (data as { id: string }).id;
  }

  // ── Helper: create billing periods ───────────────────────────────────────
  async function createBillingPeriods(awardId: string, periodType: string, awardStart: string, awardEnd: string): Promise<number> {
    const rows = generatePeriodRows(awardId, periodType, awardStart, awardEnd);
    if (!rows.length) return 0;
    const { error } = await admin.from('award_periods').insert(rows);
    if (error) throw new Error(`Failed to create billing periods: ${error.message}`);
    return rows.length;
  }

  // ── Helper: create cost entry ────────────────────────────────────────────
  async function createCostEntry(periodId: string, awardId: string): Promise<void> {
    await admin.from('period_cost_entries').insert({
      period_id:    periodId,
      award_id:     awardId,
      cost_item_id: firstCostItemId,
      submitted_by: createdBy,
      entry_type:   'timesheet',
      quantity:     8,
      unit_price:   120,
      currency:     'EUR',
      description:  'Day rate — test entry',
      notes:        'Auto-generated E2E cost entry',
      status:       'draft',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP A — Full E2E (5 scenarios)
  // ═══════════════════════════════════════════════════════════════════════════

  await log('━━━ Group A: Full E2E Scenarios ━━━', 'info');

  // Scenario 1 — Senior Frontend Developer: screening → award(active) + billing periods + cost entry
  {
    await log('[1/15] Senior Frontend Developer — contractor, weekly billing…');
    try {
      const title = 'Senior Frontend Developer';
      const demandId = await createDemand({
        title, status: 'screening', contractType: 'contractor',
        billingPeriodType: 'weekly',
        skills: ['React', 'TypeScript', 'Next.js', 'GraphQL', 'Tailwind CSS'],
        budgetMin: 800, budgetMax: 1200,
        startDate: startDate, endDate: endDate6m,
      });
      await log('  ✓ Demand created (screening)', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Lukas Bauer', status: 'proposed', proposedRate: 950, rateType: 'daily',
      });
      await log('  ✓ Submission created (proposed)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Lukas Bauer',
        status: 'active', rate: 950, rateType: 'daily',
        billingPeriodType: 'weekly', startDate, endDate: endDate3m,
      });
      await log('  ✓ Award created (active)', 'success');

      const periodsCreated = await createBillingPeriods(awardId, 'weekly', startDate, endDate3m);
      await log(`  ✓ ${periodsCreated} billing periods generated`, 'success');

      // Add cost entry to first period
      let costEntriesCreated = 0;
      if (periodsCreated > 0) {
        const { data: periods } = await admin.from('award_periods').select('id').eq('award_id', awardId).order('period_number').limit(1);
        const firstPeriodId = (periods as { id: string }[])?.[0]?.id;
        if (firstPeriodId) {
          await createCostEntry(firstPeriodId, awardId);
          costEntriesCreated = 1;
          await log('  ✓ Cost entry added to Week 1', 'success');
        }
      }

      results.push({ demandId, demandTitle: title, submissionId, awardId, periodsCreated, costEntriesCreated });
    } catch (e) {
      await log(`  ✗ Scenario 1 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 2 — Data Scientist: screening → award(active) + monthly billing periods
  {
    await log('[2/15] Data Scientist — contractor, monthly billing…');
    try {
      const title = 'Data Scientist (ML/AI)';
      const demandId = await createDemand({
        title, status: 'screening', contractType: 'contractor',
        billingPeriodType: 'monthly',
        skills: ['Python', 'Machine Learning', 'PyTorch', 'SQL', 'Data Engineering'],
        budgetMin: 900, budgetMax: 1400,
      });
      await log('  ✓ Demand created (screening)', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Ayla Demir', status: 'proposed', proposedRate: 1100, rateType: 'daily',
      });
      await log('  ✓ Submission created (proposed)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Ayla Demir',
        status: 'active', rate: 1100, rateType: 'daily',
        billingPeriodType: 'monthly', startDate, endDate: endDate6m,
      });
      await log('  ✓ Award created (active)', 'success');

      const periodsCreated = await createBillingPeriods(awardId, 'monthly', startDate, endDate6m);
      await log(`  ✓ ${periodsCreated} billing periods generated`, 'success');

      results.push({ demandId, demandTitle: title, submissionId, awardId, periodsCreated, costEntriesCreated: 0 });
    } catch (e) {
      await log(`  ✗ Scenario 2 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 3 — Project Manager: screening → award(active)
  {
    await log('[3/15] Project Manager — permanent contract, award active…');
    try {
      const title = 'IT Project Manager';
      const demandId = await createDemand({
        title, status: 'screening', contractType: 'permanent',
        billingPeriodType: 'monthly',
        skills: ['PMP', 'Agile', 'Scrum', 'JIRA', 'Stakeholder Management'],
        budgetMin: 80000, budgetMax: 100000,
        endDate: undefined, // permanent
      });
      await log('  ✓ Demand created (screening)', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Marco Rossi', status: 'proposed', proposedRate: 90000, rateType: 'annual',
      });
      await log('  ✓ Submission created (proposed)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Marco Rossi',
        status: 'active', rate: 90000, rateType: 'annual', billingPeriodType: 'monthly',
        startDate, endDate: endDate6m,
      });
      await log('  ✓ Award created (active)', 'success');

      const periodsCreated = await createBillingPeriods(awardId, 'monthly', startDate, endDate6m);
      await log(`  ✓ ${periodsCreated} billing periods generated`, 'success');

      let costEntriesCreated = 0;
      if (periodsCreated > 0) {
        const { data: periods } = await admin.from('award_periods').select('id').eq('award_id', awardId).order('period_number').limit(1);
        const firstPeriodId = (periods as { id: string }[])?.[0]?.id;
        if (firstPeriodId) {
          await createCostEntry(firstPeriodId, awardId);
          costEntriesCreated = 1;
          await log('  ✓ Cost entry added to Period 1', 'success');
        }
      }

      results.push({ demandId, demandTitle: title, submissionId, awardId, periodsCreated, costEntriesCreated });
    } catch (e) {
      await log(`  ✗ Scenario 3 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 4 — Backend Engineer: award stage → submission(offer) → award(approved)
  {
    await log('[4/15] Backend Engineer — contractor, bi-weekly, award approved…');
    try {
      const title = 'Senior Backend Engineer (Java)';
      const demandId = await createDemand({
        title, status: 'award', contractType: 'contractor',
        billingPeriodType: 'bi_weekly',
        skills: ['Java', 'Spring Boot', 'Kubernetes', 'PostgreSQL', 'REST APIs'],
        budgetMin: 700, budgetMax: 1100,
      });
      await log('  ✓ Demand created (award stage)', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Stefan Hoffmann', status: 'offer', proposedRate: 850, rateType: 'daily',
      });
      await log('  ✓ Submission created (offer)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Stefan Hoffmann',
        status: 'approved', rate: 850, rateType: 'daily', billingPeriodType: 'bi_weekly',
      });
      await log('  ✓ Award created (approved)', 'success');

      results.push({ demandId, demandTitle: title, submissionId, awardId });
    } catch (e) {
      await log(`  ✗ Scenario 4 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 5 — DevOps Specialist: award stage → award(pending_approval)
  {
    await log('[5/15] DevOps Specialist — contractor, weekly, award pending approval…');
    try {
      const title = 'DevOps / Platform Engineer';
      const demandId = await createDemand({
        title, status: 'award', contractType: 'contractor',
        billingPeriodType: 'weekly',
        skills: ['Kubernetes', 'Terraform', 'CI/CD', 'AWS', 'Docker'],
        budgetMin: 800, budgetMax: 1300,
      });
      await log('  ✓ Demand created (award stage)', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Fatima Al-Rashid', status: 'offer', proposedRate: 1000, rateType: 'daily',
      });
      await log('  ✓ Submission created (offer)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Fatima Al-Rashid',
        status: 'pending_approval', rate: 1000, rateType: 'daily', billingPeriodType: 'weekly',
      });
      await log('  ✓ Award created (pending_approval)', 'success');

      results.push({ demandId, demandTitle: title, submissionId, awardId });
    } catch (e) {
      await log(`  ✗ Scenario 5 failed: ${(e as Error).message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP B — Demand to Award (5 scenarios)
  // ═══════════════════════════════════════════════════════════════════════════

  await log('━━━ Group B: Demand → Award Scenarios ━━━', 'info');

  // Scenario 6 — UX Designer: award active (no billing periods)
  {
    await log('[6/15] UX Designer — freelance, milestone billing, award active…');
    try {
      const title = 'Senior UX / Product Designer';
      const demandId = await createDemand({
        title, status: 'award', contractType: 'freelance',
        billingPeriodType: 'milestone',
        skills: ['Figma', 'UX Research', 'Prototyping', 'Design Systems', 'User Testing'],
        budgetMin: 80, budgetMax: 140,
      });
      await log('  ✓ Demand created', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Elena Müller', status: 'offer', proposedRate: 120, rateType: 'hourly',
      });
      await log('  ✓ Submission created (offer)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Elena Müller',
        status: 'active', rate: 120, rateType: 'hourly', billingPeriodType: 'milestone',
        startDate, endDate: endDate6m,
      });
      await log('  ✓ Award created (active)', 'success');

      const periodsCreated = await createBillingPeriods(awardId, 'milestone', startDate, endDate6m);
      await log(`  ✓ ${periodsCreated} billing period(s) generated (milestone)`, 'success');

      let costEntriesCreated = 0;
      if (periodsCreated > 0) {
        const { data: periods } = await admin.from('award_periods').select('id').eq('award_id', awardId).order('period_number').limit(1);
        const firstPeriodId = (periods as { id: string }[])?.[0]?.id;
        if (firstPeriodId) {
          await createCostEntry(firstPeriodId, awardId);
          costEntriesCreated = 1;
          await log('  ✓ Cost entry added to Milestone 1', 'success');
        }
      }

      results.push({ demandId, demandTitle: title, submissionId, awardId, periodsCreated, costEntriesCreated });
    } catch (e) {
      await log(`  ✗ Scenario 6 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 7 — Business Analyst: award approved
  {
    await log('[7/15] Business Analyst — contractor, monthly, award approved…');
    try {
      const title = 'Business Analyst (ERP / SAP)';
      const demandId = await createDemand({
        title, status: 'award', contractType: 'contractor',
        billingPeriodType: 'monthly',
        skills: ['SAP S/4HANA', 'Business Analysis', 'Requirements Engineering', 'SQL', 'Stakeholder Management'],
        budgetMin: 700, budgetMax: 1000,
      });
      await log('  ✓ Demand created', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Tobias Krämer', status: 'offer', proposedRate: 800, rateType: 'daily',
      });
      await log('  ✓ Submission created (offer)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Tobias Krämer',
        status: 'approved', rate: 800, rateType: 'daily', billingPeriodType: 'monthly',
      });
      await log('  ✓ Award created (approved)', 'success');

      results.push({ demandId, demandTitle: title, submissionId, awardId });
    } catch (e) {
      await log(`  ✗ Scenario 7 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 8 — Scrum Master: award pending_approval
  {
    await log('[8/15] Scrum Master — permanent, award pending approval…');
    try {
      const title = 'Agile Coach / Scrum Master';
      const demandId = await createDemand({
        title, status: 'award', contractType: 'permanent',
        skills: ['Scrum', 'SAFe', 'Agile Coaching', 'Confluence', 'Facilitation'],
        budgetMin: 70000, budgetMax: 90000,
      });
      await log('  ✓ Demand created', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Claudia Fischer', status: 'offer', proposedRate: 80000, rateType: 'annual',
      });
      await log('  ✓ Submission created (offer)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Claudia Fischer',
        status: 'pending_approval', rate: 80000, rateType: 'annual',
      });
      await log('  ✓ Award created (pending_approval)', 'success');

      results.push({ demandId, demandTitle: title, submissionId, awardId });
    } catch (e) {
      await log(`  ✗ Scenario 8 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 9 — Technical Writer: demand(award) → award directly (no submission)
  {
    await log('[9/15] Technical Writer — freelance, direct award (no submission)…');
    try {
      const title = 'Technical Writer / Documentation Specialist';
      const demandId = await createDemand({
        title, status: 'award', contractType: 'freelance',
        billingPeriodType: 'fixed',
        skills: ['Technical Writing', 'API Documentation', 'Markdown', 'Confluence', 'English'],
        budgetMin: 60, budgetMax: 100,
      });
      await log('  ✓ Demand created', 'success');

      // No submission — direct award
      const awardId = await createAward({
        demandId, demandTitle: title, candidateName: 'Maximilian Weiß',
        status: 'pending_approval', rate: 75, rateType: 'hourly', billingPeriodType: 'fixed',
      });
      await log('  ✓ Award created directly (no submission, pending_approval)', 'success');

      results.push({ demandId, demandTitle: title, awardId });
    } catch (e) {
      await log(`  ✗ Scenario 9 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 10 — IT Support: demand(filled) → submission(awarded) → award(completed)
  {
    await log('[10/15] IT Support Specialist — permanent, demand filled, award completed…');
    try {
      const title = 'IT Support Specialist (L2)';
      const demandId = await createDemand({
        title, status: 'filled', contractType: 'permanent',
        skills: ['Windows', 'Active Directory', 'ITSM', 'ServiceNow', 'Networking'],
        budgetMin: 45000, budgetMax: 60000,
        startDate: isoDate(addMonths(now, -3)), // already started 3 months ago
        endDate: endDate3m,
      });
      await log('  ✓ Demand created (filled)', 'success');

      const submissionId = await createSubmission({
        demandId, candidateName: 'Petra Schneider', status: 'awarded', proposedRate: 52000, rateType: 'annual',
      });
      await log('  ✓ Submission created (awarded)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, submissionId, candidateName: 'Petra Schneider',
        status: 'completed', rate: 52000, rateType: 'annual',
        startDate: isoDate(addMonths(now, -3)),
        endDate: isoDate(addMonths(now, -1)),
      });
      await log('  ✓ Award created (completed)', 'success');

      results.push({ demandId, demandTitle: title, submissionId, awardId });
    } catch (e) {
      await log(`  ✗ Scenario 10 failed: ${(e as Error).message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP C — Demand Process Only (5 scenarios)
  // ═══════════════════════════════════════════════════════════════════════════

  await log('━━━ Group C: Demand Process Scenarios ━━━', 'info');

  // Scenario 11 — Marketing Manager: sourcing stage
  {
    await log('[11/15] Marketing Manager — permanent, sourcing stage…');
    try {
      const title = 'Head of Digital Marketing';
      const demandId = await createDemand({
        title, status: 'sourcing', contractType: 'permanent',
        skills: ['Digital Marketing', 'SEO/SEM', 'Content Strategy', 'Analytics', 'B2B Marketing'],
        budgetMin: 75000, budgetMax: 95000,
      });
      await log('  ✓ Demand created (sourcing)', 'success');
      results.push({ demandId, demandTitle: title });
    } catch (e) {
      await log(`  ✗ Scenario 11 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 12 — HR Business Partner: pending_approval
  {
    await log('[12/15] HR Business Partner — permanent, pending approval…');
    try {
      const title = 'HR Business Partner';
      const demandId = await createDemand({
        title, status: 'pending_approval', contractType: 'permanent',
        skills: ['HRBP', 'Labour Law', 'Talent Management', 'SAP HCM', 'Change Management'],
        budgetMin: 65000, budgetMax: 85000,
      });
      await log('  ✓ Demand created (pending_approval)', 'success');
      results.push({ demandId, demandTitle: title });
    } catch (e) {
      await log(`  ✗ Scenario 12 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 13 — Finance Analyst: cancelled
  {
    await log('[13/15] Finance Analyst — permanent, cancelled…');
    try {
      const title = 'Finance & Controlling Analyst';
      const demandId = await createDemand({
        title, status: 'cancelled', contractType: 'permanent',
        skills: ['Financial Reporting', 'SAP FI/CO', 'Excel', 'Power BI', 'IFRS'],
        budgetMin: 55000, budgetMax: 75000,
        description: 'Headcount freeze — demand cancelled after budget review.',
      });
      await log('  ✓ Demand created (cancelled)', 'success');
      results.push({ demandId, demandTitle: title });
    } catch (e) {
      await log(`  ✗ Scenario 13 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 14 — Sales Executive: on_hold
  {
    await log('[14/15] Sales Executive — permanent, on hold…');
    try {
      const title = 'Senior Sales Executive (B2B SaaS)';
      const demandId = await createDemand({
        title, status: 'on_hold', contractType: 'permanent',
        skills: ['B2B Sales', 'CRM (Salesforce)', 'Negotiation', 'SaaS', 'Account Management'],
        budgetMin: 70000, budgetMax: 100000,
        description: 'On hold pending organisational restructuring in Q3.',
      });
      await log('  ✓ Demand created (on_hold)', 'success');
      results.push({ demandId, demandTitle: title });
    } catch (e) {
      await log(`  ✗ Scenario 14 failed: ${(e as Error).message}`, 'error');
    }
  }

  // Scenario 15 — Operations Lead: filled (contractor, no submission needed)
  {
    await log('[15/15] Operations Lead — contractor, demand filled…');
    try {
      const title = 'Operations Lead / Supply Chain Manager';
      const demandId = await createDemand({
        title, status: 'filled', contractType: 'contractor',
        billingPeriodType: 'monthly',
        skills: ['Supply Chain', 'SAP MM/SD', 'Lean', 'Six Sigma', 'Logistics'],
        budgetMin: 800, budgetMax: 1200,
      });
      await log('  ✓ Demand created (filled)', 'success');

      const awardId = await createAward({
        demandId, demandTitle: title, candidateName: 'Niklas Bergmann',
        status: 'active', rate: 1000, rateType: 'daily', billingPeriodType: 'monthly',
      });
      await log('  ✓ Award created (active)', 'success');

      results.push({ demandId, demandTitle: title, awardId });
    } catch (e) {
      await log(`  ✗ Scenario 15 failed: ${(e as Error).message}`, 'error');
    }
  }

  return results;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role?: string } | null)?.role ?? '';
  if (!['admin', 'super_admin'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 });
  }

  const body = await req.json() as { tenantId?: string };
  const { tenantId } = body;
  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'tenantId is required' }), { status: 400 });
  }

  // Set up streaming response
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const log: LogFn = async (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ msg, type })}\n\n`));
    } catch { /* client disconnected */ }
  };

  // Run generation in background (non-blocking)
  ;(async () => {
    try {
      await log('Starting E2E test data generation for tenant…', 'info');
      const results = await generateTestData(tenantId, log);
      const successful = results.length;
      const withAwards = results.filter(r => r.awardId).length;
      const withPeriods = results.filter(r => (r.periodsCreated ?? 0) > 0).length;
      await log(`━━━ Complete! ${successful}/15 scenarios created, ${withAwards} with awards, ${withPeriods} with billing periods ━━━`, 'success');
      await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, count: successful, results })}\n\n`));
    } catch (e) {
      await log(`Fatal error: ${(e as Error).message}`, 'error');
      await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, error: (e as Error).message })}\n\n`));
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
