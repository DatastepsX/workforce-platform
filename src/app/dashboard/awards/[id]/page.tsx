'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { updateAwardStatus, updateAwardPO } from '@/lib/actions/awards';
import { getAvailableCostItems } from '@/lib/actions/cost-items';
import { listAwardPeriods, generateAwardPeriods, updateAwardBillingPeriodType } from '@/lib/actions/award-periods';
import type { Award, AwardStatus, UserRole, BillingPeriodType, AwardPeriod } from '@/types/database';

const STATUS_META: Record<AwardStatus, { label: string; color: string }> = {
  pending_approval: { label: 'Pending Approval', color: '#FF9500' },
  approved:         { label: 'Approved',          color: '#007AFF' },
  active:           { label: 'Active',            color: '#34C759' },
  completed:        { label: 'Completed',         color: '#8E8E93' },
  cancelled:        { label: 'Cancelled',         color: '#FF3B30' },
};

const TRANSITIONS: Record<AwardStatus, { to: AwardStatus; label: string; color: string }[]> = {
  pending_approval: [
    { to: 'approved',  label: '✓ Approve',       color: '#007AFF' },
    { to: 'cancelled', label: '✕ Cancel Award',  color: '#FF3B30' },
  ],
  approved: [
    { to: 'active',    label: '▶ Mark Active',   color: '#34C759' },
    { to: 'cancelled', label: '✕ Cancel Award',  color: '#FF3B30' },
  ],
  active: [
    { to: 'completed', label: '✓ Mark Completed', color: '#8E8E93' },
    { to: 'cancelled', label: '✕ Cancel Award',   color: '#FF3B30' },
  ],
  completed: [],
  cancelled: [],
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-3 border-b border-[#F2F2F7] last:border-0 gap-1">
      <span className="text-[13px] text-[#8E8E93] font-medium sm:min-w-[140px] sm:flex-shrink-0">{label}</span>
      <span className="text-[14px] text-black sm:text-right sm:flex-1 break-words">{value ?? '—'}</span>
    </div>
  );
}

export default async function AwardDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile?.role ?? 'candidate') as UserRole;
  if (!['super_admin', 'admin', 'recruiter', 'hiring_manager', 'procurement', 'finance'].includes(role)) {
    redirect('/dashboard');
  }

  const { data: awardData } = await supabase.from('awards').select('*').eq('id', id).single();
  if (!awardData) notFound();
  const award = awardData as Award & { po_number?: string | null };

  const meta = STATUS_META[award.status] ?? STATUS_META.pending_approval;
  const transitions = TRANSITIONS[award.status] ?? [];
  const canAct = ['super_admin', 'admin', 'recruiter', 'procurement', 'finance'].includes(role);

  function fmtDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const admin = createAdminClient();

  let creatorName: string | null = null;
  if (award.created_by) {
    const { data: creatorProfile } = await admin.from('profiles').select('full_name, email').eq('id', award.created_by).single();
    creatorName = (creatorProfile as { full_name: string | null; email: string | null } | null)?.full_name
      || (creatorProfile as { full_name: string | null; email: string | null } | null)?.email || null;
  }

  // Fetch demand contract type for cost items
  let demandContractType: string | null = null;
  if (award.demand_id) {
    const { data: demandRow } = await admin.from('demands').select('contract_type').eq('id', award.demand_id).single();
    demandContractType = (demandRow as { contract_type: string | null } | null)?.contract_type ?? null;
  }

  const applicableCostItems = demandContractType
    ? await getAvailableCostItems({ contractType: demandContractType, tenantId: award.tenant_id ?? undefined }).catch(() => [])
    : [];

  const periods: AwardPeriod[] = await listAwardPeriods(id).catch(() => []);

  const PERIOD_TYPES: { value: BillingPeriodType; label: string }[] = [
    { value: 'weekly',    label: 'Weekly'     },
    { value: 'bi_weekly', label: 'Bi-weekly'  },
    { value: 'monthly',   label: 'Monthly'    },
    { value: 'milestone', label: 'Milestone'  },
    { value: 'fixed',     label: 'Fixed Fee'  },
  ];

  const PERIOD_STATUS_COLOR: Record<string, string> = {
    open:      '#34C759',
    submitted: '#FF9500',
    approved:  '#007AFF',
    invoiced:  '#5856D6',
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/awards" className="hover:text-[#007AFF] transition-colors">Awards</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-black font-medium truncate">{award.candidate_name}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: meta.color + '18', color: meta.color }}
          >
            {meta.label}
          </span>
        </div>
        <h1 className="text-[26px] sm:text-[28px] font-bold text-black tracking-tight leading-tight break-words">{award.candidate_name}</h1>
        <p className="text-[15px] text-[#8E8E93] mt-1 break-words">{award.demand_title}</p>
      </div>

      {/* Status actions */}
      {canAct && transitions.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Actions</p>
          <div className="flex flex-wrap gap-2">
            {transitions.map(t => {
              async function doTransition() {
                'use server';
                await updateAwardStatus(id, t.to);
              }
              return (
                <form key={t.to} action={doTransition}>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-opacity hover:opacity-80"
                    style={{ backgroundColor: t.color + '15', color: t.color }}
                  >
                    {t.label}
                  </button>
                </form>
              );
            })}
          </div>
          {award.status === 'pending_approval' && (
            <p className="text-[12px] text-[#8E8E93] mt-3">
              Approving this award confirms the candidate selection and financial terms.
            </p>
          )}
        </div>
      )}

      {/* PO Number */}
      {canAct && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Purchase Order</p>
          <form
            action={async (formData: FormData) => {
              'use server';
              const po = formData.get('po_number') as string;
              await updateAwardPO(id, po);
            }}
            className="flex gap-2"
          >
            <input
              name="po_number"
              defaultValue={award.po_number ?? ''}
              placeholder="e.g. PO-2026-001"
              className="flex-1 bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-[14px] text-black placeholder:text-[#C7C7CC] outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#007AFF' }}
            >
              Save PO
            </button>
          </form>
          {award.po_number && (
            <p className="text-[12px] text-[#8E8E93] mt-2">Current PO: <span className="font-semibold text-black">{award.po_number}</span></p>
          )}
        </div>
      )}

      {/* Candidate & demand info */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Award Details</p>
        <DetailRow label="Candidate" value={
          <div>
            <p className="font-semibold">{award.candidate_name}</p>
            {award.candidate_email && (
              <a href={`mailto:${award.candidate_email}`} className="text-[13px] text-[#007AFF] hover:underline break-all">{award.candidate_email}</a>
            )}
          </div>
        } />
        {award.supplier_name && <DetailRow label="Via Supplier" value={award.supplier_name} />}
        <DetailRow label="Demand" value={
          award.demand_id ? (
            <Link href={`/dashboard/demands/${award.demand_id}`} className="text-[#007AFF] hover:underline">
              {award.demand_title}
            </Link>
          ) : award.demand_title
        } />
      </div>

      {/* Financial terms */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Financial Terms</p>
        <DetailRow label="Rate" value={
          award.rate
            ? <span className="font-bold text-[16px]">{award.currency} {award.rate.toLocaleString()} <span className="text-[13px] font-normal text-[#8E8E93]">/ {award.rate_type}</span></span>
            : undefined
        } />
        <DetailRow label="Total Volume" value={
          award.total_amount
            ? <span className="font-bold">{award.currency} {award.total_amount.toLocaleString()}{award.price_locked ? ' 🔒' : ''}</span>
            : undefined
        } />
        {award.po_number && <DetailRow label="PO Number" value={<span className="font-semibold text-[#007AFF]">{award.po_number}</span>} />}
        <DetailRow label="Start Date" value={fmtDate(award.start_date)} />
        <DetailRow label="End Date" value={fmtDate(award.end_date)} />
        <DetailRow label="Currency" value={award.currency} />
      </div>

      {/* Applicable Cost Items */}
      {applicableCostItems.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Applicable Cost Items</p>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F4FD] text-[#007AFF]">
              {demandContractType?.toUpperCase()}
            </span>
          </div>
          <div className="space-y-1">
            {['Labor','Statutory','Fee','Expense','Compliance','Project Cost','Adjustment'].map(catName => {
              const group = applicableCostItems.filter(i => i.category?.name === catName);
              if (!group.length) return null;
              return (
                <div key={catName} className="mb-3">
                  <p className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1.5">{catName}</p>
                  <div className="grid grid-cols-1 gap-1">
                    {group.map(item => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-[#F9F9FB] rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-[#007AFF] bg-[#E8F4FD] px-1.5 py-0.5 rounded">{item.code}</span>
                          <span className="text-[13px] font-medium text-black">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.markup_eligible && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FFF4E8] text-[#FF9500]">Markup</span>}
                          {item.pass_through && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F0EFFE] text-[#5856D6]">Pass-thru</span>}
                          <span className="text-[11px] text-[#8E8E93]">{item.billing_type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {['super_admin','admin'].includes(role) && (
            <a href="/dashboard/settings/cost-items" className="mt-3 block text-[12px] text-[#007AFF] hover:underline">Manage cost items →</a>
          )}
        </div>
      )}

      {/* Billing Periods */}
      {canAct && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Billing Periods</p>
            {periods.length > 0 && (
              <Link href="/dashboard/cost-items" className="text-[12px] text-[#007AFF] hover:underline">
                View in Cost Items →
              </Link>
            )}
          </div>

          {/* Period type selector */}
          {award.status === 'active' && (
            <div className="mb-4">
              <form action={async (fd: FormData) => {
                'use server';
                const pt = fd.get('period_type') as BillingPeriodType;
                await updateAwardBillingPeriodType(id, pt);
              }} className="flex gap-2 items-center">
                <select name="period_type" defaultValue={award.billing_period_type ?? ''}
                  className="flex-1 bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
                  <option value="">— Select period type —</option>
                  {PERIOD_TYPES.map(pt => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
                <button type="submit" className="px-3 py-2.5 bg-[#F2F2F7] text-black text-[13px] font-semibold rounded-xl hover:bg-[#E5E5EA] transition-colors whitespace-nowrap">
                  Save Type
                </button>
              </form>
            </div>
          )}

          {/* Generate button */}
          {canAct && award.status === 'active' && award.start_date && award.end_date && award.billing_period_type && (
            <form action={async () => {
              'use server';
              try { await generateAwardPeriods(id); } catch { /* period type not set */ }
            }} className="mb-4">
              <button type="submit"
                className="w-full py-2.5 bg-[#007AFF] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">
                ⟳ Generate Billing Periods
              </button>
              {periods.length > 0 && (
                <p className="text-[11px] text-[#FF9500] text-center mt-1">This will regenerate all periods and delete existing ones</p>
              )}
            </form>
          )}

          {/* Periods list */}
          {periods.length === 0 ? (
            <div className="text-center py-4">
              {award.status === 'active' && !award.billing_period_type && (
                <p className="text-[13px] text-[#8E8E93]">
                  1. Select a billing period type above and click <strong>Save Type</strong>.<br />
                  2. Then click <strong>Generate Billing Periods</strong>.
                </p>
              )}
              {award.status === 'active' && award.billing_period_type && (
                <p className="text-[13px] text-[#8E8E93]">Click <strong>Generate Billing Periods</strong> to create periods.</p>
              )}
              {award.status !== 'active' && (
                <p className="text-[13px] text-[#8E8E93]">Billing periods are generated once the award is active.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {periods.map(p => (
                <Link key={p.id} href={`/dashboard/cost-items/${p.id}`}
                  className="flex items-center justify-between bg-[#F9F9FB] rounded-xl px-4 py-3 hover:bg-[#F2F2F7] transition-colors">
                  <div>
                    <p className="text-[13px] font-semibold text-black">{p.label}</p>
                    {(p.start_date || p.end_date) && (
                      <p className="text-[11px] text-[#8E8E93]">
                        {p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                        {p.end_date ? ` – ${new Date(p.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.total_amount != null && (
                      <span className="text-[13px] font-bold text-black">€{p.total_amount.toLocaleString()}</span>
                    )}
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: (PERIOD_STATUS_COLOR[p.status] ?? '#8E8E93') + '18', color: PERIOD_STATUS_COLOR[p.status] ?? '#8E8E93' }}>
                      {p.status}
                    </span>
                    <svg className="w-4 h-4 text-[#C7C7CC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {award.notes && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Notes</p>
          <p className="text-[14px] text-black leading-relaxed whitespace-pre-wrap">{award.notes}</p>
        </div>
      )}

      {/* Meta */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Meta</p>
        <DetailRow label="Created by" value={creatorName ?? '—'} />
        <DetailRow label="Created" value={fmtDate(award.created_at)} />
        <DetailRow label="Last updated" value={fmtDate(award.updated_at)} />
        {award.submission_id && (
          <DetailRow label="Submission" value={
            award.demand_id ? (
              <Link href={`/dashboard/demands/${award.demand_id}`} className="text-[#007AFF] hover:underline text-[13px]">
                View demand submissions →
              </Link>
            ) : undefined
          } />
        )}
      </div>
    </div>
  );
}
