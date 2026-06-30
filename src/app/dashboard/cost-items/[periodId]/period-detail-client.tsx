'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { AwardPeriod, PeriodCostEntry, CostItem } from '@/types/database';
import {
  createCostEntry,
  createDailyTimesheetEntries,
  submitPeriod,
  reviewCostEntry,
  deleteCostEntry,
  updateCostEntry,
  updatePeriodStatus,
} from '@/lib/actions/award-periods';

type PeriodWithEntries = AwardPeriod & { entries: (PeriodCostEntry & { cost_item?: CostItem | null })[] };
type AwardInfo = { id: string; candidate_name: string; demand_title: string; supplier_name: string | null; rate: number | null; rate_type: string | null; currency: string | null } | null;

interface Props {
  period: PeriodWithEntries;
  award: AwardInfo;
  costItems: CostItem[];
  role: string;
  userId: string;
}

const ENTRY_TYPE_META: Record<string, { label: string; icon: string }> = {
  timesheet: { label: 'Timesheet', icon: '⏱' },
  expense:   { label: 'Expense',   icon: '🧾' },
  milestone: { label: 'Milestone', icon: '🏁' },
  fee:       { label: 'Fee',       icon: '💼' },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open:      { label: 'Open',      cls: 'bg-[#E8FAF0] text-[#34C759]'  },
  submitted: { label: 'Submitted', cls: 'bg-[#FFF4E8] text-[#FF9500]'  },
  approved:  { label: 'Approved',  cls: 'bg-[#E8F4FD] text-[#007AFF]'  },
  invoiced:  { label: 'Invoiced',  cls: 'bg-[#F0EFFE] text-[#5856D6]'  },
  draft:     { label: 'Draft',     cls: 'bg-[#F2F2F7] text-[#8E8E93]'  },
  rejected:  { label: 'Rejected',  cls: 'bg-[#FFECEC] text-[#FF3B30]'  },
};

function getWeekdays(startDate: string | null, endDate: string | null): Date[] {
  if (!startDate || !endDate) return [];
  const days: Date[] = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export function PeriodDetailClient({ period, award, costItems, role, userId }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'daily'>('single');
  const [entryType, setEntryType] = useState('timesheet');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [dailyQty, setDailyQty] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const awardRate = award?.rate ?? null;
  const awardRateType = award?.rate_type ?? 'daily';
  const awardCurrency = award?.currency ?? 'EUR';
  const qtyLabel = awardRateType === 'hourly' ? 'Hours' : 'Days';

  const weekdays = getWeekdays(period.start_date, period.end_date);

  const isStaff = ['admin','super_admin','recruiter','hiring_manager','procurement','finance'].includes(role);
  const canSubmit = ['supplier','candidate'].includes(role) && period.status === 'open';
  const canReview = isStaff && period.status === 'submitted';
  const canAddEntry = period.status === 'open';
  const canApprove = isStaff && period.status === 'submitted';
  const canInvoice = isStaff && period.status === 'approved';

  function fmtDate(d: string | null) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtAmount(amount: number | null | undefined) {
    if (amount == null) return '—';
    return `${awardCurrency === 'EUR' ? '€' : awardCurrency}${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const totalAmount = period.entries
    .filter(e => e.status !== 'rejected')
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const sm = STATUS_META[period.status] ?? STATUS_META.open;

  // Daily timesheet total preview
  const dailyTotal = weekdays.reduce((s, d) => {
    const v = parseFloat(dailyQty[isoDate(d)] ?? '0') || 0;
    return s + v * (awardRate ?? 0);
  }, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link href="/dashboard/cost-items" className="text-[13px] text-[#007AFF] flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        Cost Items
      </Link>

      {/* Header */}
      <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold text-black">{period.label}</h1>
            {award && (
              <p className="text-[13px] text-[#8E8E93] mt-0.5">{award.candidate_name} · {award.demand_title}</p>
            )}
            {(period.start_date || period.end_date) && (
              <p className="text-[12px] text-[#C7C7CC] mt-0.5">
                {fmtDate(period.start_date)}{period.end_date ? ` – ${fmtDate(period.end_date)}` : ''}
              </p>
            )}
          </div>
          <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${sm.cls}`}>{sm.label}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-0.5">Total</p>
            <p className="text-[18px] font-bold text-black">{fmtAmount(totalAmount)}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-0.5">Entries</p>
            <p className="text-[18px] font-bold text-black">{period.entries.length}</p>
          </div>
          {awardRate && (
            <div>
              <p className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-0.5">Award Rate</p>
              <p className="text-[14px] font-semibold text-black">
                {fmtAmount(awardRate)}/{awardRateType}
              </p>
            </div>
          )}
        </div>

        {/* Period actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {canSubmit && (
            <button
              onClick={() => startTransition(() => submitPeriod(period.id))}
              disabled={isPending || period.entries.filter(e => e.status === 'draft').length === 0}
              className="px-4 py-2 bg-[#007AFF] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0066DD] disabled:opacity-40 transition-colors"
            >
              Submit Period
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => startTransition(async () => { await updatePeriodStatus(period.id, 'approved'); })}
              disabled={isPending}
              className="px-4 py-2 bg-[#34C759] text-white text-[13px] font-semibold rounded-xl hover:bg-[#2DB14E] disabled:opacity-40 transition-colors"
            >
              Approve Period
            </button>
          )}
          {canInvoice && (
            <button
              onClick={() => startTransition(async () => { await updatePeriodStatus(period.id, 'invoiced'); })}
              disabled={isPending}
              className="px-4 py-2 bg-[#5856D6] text-white text-[13px] font-semibold rounded-xl hover:bg-[#4F4EC2] disabled:opacity-40 transition-colors"
            >
              Mark Invoiced
            </button>
          )}
          {canAddEntry && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-[#F2F2F7] text-black text-[13px] font-semibold rounded-xl hover:bg-[#E5E5EA] transition-colors ml-auto"
            >
              {showAddForm ? 'Cancel' : '+ Add Entry'}
            </button>
          )}
        </div>
      </div>

      {/* Add entry form */}
      {showAddForm && (
        <div className="bg-white border border-[#007AFF]/30 rounded-2xl p-5 mb-4">
          {/* Mode tabs */}
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => setAddMode('single')}
              className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors ${addMode === 'single' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
              Single Entry
            </button>
            <button type="button" onClick={() => setAddMode('daily')}
              className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors ${addMode === 'daily' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
              📅 Daily Timesheet
            </button>
          </div>

          {addMode === 'single' ? (
            <form action={async (fd) => {
              await createCostEntry(fd);
              setShowAddForm(false);
            }}>
              <input type="hidden" name="period_id" value={period.id} />
              <div className="space-y-3">
                {/* Entry type */}
                <div>
                  <label className="text-[12px] text-[#8E8E93] uppercase tracking-wide mb-1 block">Type</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(ENTRY_TYPE_META).map(([v, m]) => (
                      <button key={v} type="button" onClick={() => setEntryType(v)}
                        className={`py-2 px-3 rounded-xl border text-[13px] font-medium transition-colors ${entryType === v ? 'border-[#007AFF] bg-[#E8F4FD] text-[#007AFF]' : 'border-[#E5E5EA] text-[#8E8E93] hover:border-[#007AFF]/40'}`}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="entry_type" value={entryType} />
                </div>
                {/* Cost item picker */}
                {costItems.length > 0 && (
                  <div>
                    <label className="text-[12px] text-[#8E8E93] uppercase tracking-wide mb-1 block">Cost Item (optional)</label>
                    <select name="cost_item_id" className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30">
                      <option value="">— None —</option>
                      {costItems.map(ci => (
                        <option key={ci.id} value={ci.id}>{ci.code} — {ci.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Description */}
                <div>
                  <label className="text-[12px] text-[#8E8E93] uppercase tracking-wide mb-1 block">Description</label>
                  <input name="description" placeholder="e.g. Week 1 development work" required
                    className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                </div>
                {/* Quantity + Unit price */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] text-[#8E8E93] uppercase tracking-wide mb-1 block">
                      {entryType === 'timesheet' ? qtyLabel : 'Quantity'}
                    </label>
                    <input name="quantity" type="number" step="0.01" min="0" placeholder="0" required
                      className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                  </div>
                  <div>
                    <label className="text-[12px] text-[#8E8E93] uppercase tracking-wide mb-1 block">
                      Unit Price ({awardCurrency}) {awardRate ? <span className="text-[#007AFF] font-normal">from award</span> : null}
                    </label>
                    <input name="unit_price" type="number" step="0.01" min="0"
                      defaultValue={awardRate ?? undefined}
                      placeholder="0.00" required
                      className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                  </div>
                </div>
                <input type="hidden" name="currency" value={awardCurrency} />
                {/* Notes */}
                <div>
                  <label className="text-[12px] text-[#8E8E93] uppercase tracking-wide mb-1 block">Notes (optional)</label>
                  <textarea name="notes" rows={2} placeholder="Additional notes…"
                    className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30 resize-none" />
                </div>
                <button type="submit"
                  className="w-full py-2.5 bg-[#007AFF] text-white text-[14px] font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">
                  Add Entry
                </button>
              </div>
            </form>
          ) : (
            /* Daily timesheet mode */
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[14px] font-semibold text-black">Daily Timesheet</p>
                  <p className="text-[12px] text-[#8E8E93]">Enter {qtyLabel.toLowerCase()} for each working day in this period</p>
                </div>
                {awardRate && (
                  <div className="text-right">
                    <p className="text-[11px] text-[#8E8E93]">Rate</p>
                    <p className="text-[14px] font-bold text-black">{fmtAmount(awardRate)}/{awardRateType}</p>
                  </div>
                )}
              </div>

              {weekdays.length === 0 ? (
                <p className="text-[13px] text-[#8E8E93] text-center py-4">No date range set for this period</p>
              ) : (
                <>
                  <div className="space-y-1 max-h-72 overflow-y-auto pr-1 mb-3">
                    {weekdays.map(d => {
                      const key = isoDate(d);
                      const qty = parseFloat(dailyQty[key] ?? '0') || 0;
                      return (
                        <div key={key} className="flex items-center gap-3 py-2 border-b border-[#F2F2F7]">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-black">{fmtDay(d)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input
                              type="number" step="0.5" min="0" max={awardRateType === 'hourly' ? 24 : 1}
                              value={dailyQty[key] ?? ''}
                              onChange={e => setDailyQty(prev => ({ ...prev, [key]: e.target.value }))}
                              placeholder="0"
                              className="w-20 bg-[#F2F2F7] rounded-lg px-2 py-1.5 text-[13px] text-center outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                            />
                            <span className="text-[12px] text-[#8E8E93] w-12">{qtyLabel.toLowerCase()}</span>
                            {awardRate && qty > 0 && (
                              <span className="text-[11px] text-[#007AFF] w-16 text-right font-medium">{fmtAmount(qty * awardRate)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick fill buttons */}
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => {
                      const full: Record<string, string> = {};
                      weekdays.forEach(d => { full[isoDate(d)] = awardRateType === 'hourly' ? '8' : '1'; });
                      setDailyQty(full);
                    }} className="text-[12px] text-[#007AFF] hover:underline">Fill all</button>
                    <button type="button" onClick={() => setDailyQty({})} className="text-[12px] text-[#8E8E93] hover:underline">Clear</button>
                    <span className="ml-auto text-[12px] text-[#8E8E93]">
                      {weekdays.filter(d => parseFloat(dailyQty[isoDate(d)] ?? '0') > 0).length} days entered
                    </span>
                  </div>

                  {/* Total preview */}
                  {awardRate && dailyTotal > 0 && (
                    <div className="bg-[#F2F2F7] rounded-xl px-4 py-2.5 mb-3 flex justify-between items-center">
                      <span className="text-[13px] text-[#8E8E93]">Total to submit</span>
                      <span className="text-[15px] font-bold text-black">{fmtAmount(dailyTotal)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isPending || !weekdays.some(d => parseFloat(dailyQty[isoDate(d)] ?? '0') > 0)}
                    onClick={() => startTransition(async () => {
                      const entries = weekdays
                        .filter(d => parseFloat(dailyQty[isoDate(d)] ?? '0') > 0)
                        .map(d => ({ date: isoDate(d), quantity: parseFloat(dailyQty[isoDate(d)]), description: fmtDay(d) }));
                      await createDailyTimesheetEntries(period.id, entries, awardRate ?? 0, awardCurrency);
                      setShowAddForm(false);
                      setDailyQty({});
                    })}
                    className="w-full py-2.5 bg-[#007AFF] text-white text-[14px] font-semibold rounded-xl hover:bg-[#0066DD] disabled:opacity-40 transition-colors"
                  >
                    Submit {weekdays.filter(d => parseFloat(dailyQty[isoDate(d)] ?? '0') > 0).length} Day{weekdays.filter(d => parseFloat(dailyQty[isoDate(d)] ?? '0') > 0).length !== 1 ? 's' : ''} Timesheet
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Entries list */}
      <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#F2F2F7]">
          <h2 className="text-[14px] font-semibold text-black">Cost Entries</h2>
        </div>

        {period.entries.length === 0 ? (
          <div className="py-12 text-center text-[#8E8E93]">
            <p className="text-[15px] font-medium">No entries yet</p>
            {canAddEntry && <p className="text-[13px] mt-1">Click &quot;+ Add Entry&quot; to log time, expenses or milestones</p>}
          </div>
        ) : (
          <div className="divide-y divide-[#F2F2F7]">
            {period.entries.map(entry => {
              const esm = STATUS_META[entry.status] ?? STATUS_META.draft;
              const etm = ENTRY_TYPE_META[entry.entry_type] ?? ENTRY_TYPE_META.timesheet;
              const isOwn = entry.submitted_by === userId;
              const isDraft = entry.status === 'draft';
              const isSubmitted = entry.status === 'submitted';
              const isEditing = editingId === entry.id;

              return (
                <div key={entry.id} className="px-5 py-4">
                  {isEditing ? (
                    /* Inline edit form */
                    <form action={async (fd) => {
                      await updateCostEntry(entry.id, fd);
                      setEditingId(null);
                    }} className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[13px] font-semibold text-black">Edit Entry</p>
                        <button type="button" onClick={() => setEditingId(null)} className="text-[12px] text-[#8E8E93] hover:text-black">Cancel</button>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1 block">Description</label>
                        <input name="description" defaultValue={entry.description ?? ''} required
                          className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1 block">{qtyLabel}</label>
                          <input name="quantity" type="number" step="0.01" min="0" defaultValue={entry.quantity} required
                            className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                        </div>
                        <div>
                          <label className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1 block">Unit Price</label>
                          <input name="unit_price" type="number" step="0.01" min="0" defaultValue={entry.unit_price} required
                            className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1 block">Notes</label>
                        <input name="notes" defaultValue={entry.notes ?? ''}
                          className="w-full bg-[#F2F2F7] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
                      </div>
                      <input type="hidden" name="entry_type" value={entry.entry_type} />
                      <button type="submit" className="w-full py-2 bg-[#007AFF] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">Save Changes</button>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[12px]">{etm.icon}</span>
                          <span className="text-[14px] font-semibold text-black">{entry.description || etm.label}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${esm.cls}`}>{esm.label}</span>
                        </div>
                        {entry.cost_item && (
                          <p className="text-[11px] text-[#007AFF] mt-0.5">{(entry.cost_item as CostItem).code} — {(entry.cost_item as CostItem).name}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-[12px] text-[#8E8E93]">
                          <span>{entry.quantity} {entry.entry_type === 'timesheet' ? qtyLabel.toLowerCase() : 'units'} × {fmtAmount(entry.unit_price)}</span>
                          {entry.notes && <span>· {entry.notes}</span>}
                        </div>
                        {entry.rejection_reason && (
                          <p className="text-[12px] text-[#FF3B30] mt-1">Rejected: {entry.rejection_reason}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[15px] font-bold text-black">{fmtAmount(entry.amount)}</div>
                        <div className="flex items-center gap-1.5 justify-end mt-1.5">
                          {/* Review buttons for staff */}
                          {isStaff && isSubmitted && (
                            <>
                              <button
                                onClick={() => startTransition(() => reviewCostEntry(entry.id, true))}
                                disabled={isPending}
                                className="p-1.5 rounded-lg bg-[#E8FAF0] text-[#34C759] hover:bg-[#34C759]/20 disabled:opacity-40 transition-colors"
                                title="Approve">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                              {rejecting === entry.id ? (
                                <div className="flex items-center gap-1">
                                  <input value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                                    placeholder="Reason…" className="text-[12px] px-2 py-1 bg-[#F2F2F7] rounded-lg w-28 outline-none" />
                                  <button onClick={() => startTransition(async () => {
                                    await reviewCostEntry(entry.id, false, rejectionReason);
                                    setRejecting(null); setRejectionReason('');
                                  })} disabled={isPending}
                                    className="p-1.5 rounded-lg bg-[#FFECEC] text-[#FF3B30] hover:bg-[#FF3B30]/20 disabled:opacity-40 transition-colors">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => { setRejecting(entry.id); setRejectionReason(''); }}
                                  className="p-1.5 rounded-lg bg-[#FFECEC] text-[#FF3B30] hover:bg-[#FF3B30]/20 transition-colors" title="Reject">
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                              )}
                            </>
                          )}
                          {/* Edit own draft */}
                          {(isOwn || isStaff) && isDraft && (
                            <button
                              onClick={() => setEditingId(entry.id)}
                              className="p-1.5 rounded-lg bg-[#F2F2F7] text-[#8E8E93] hover:bg-[#E8F4FD] hover:text-[#007AFF] transition-colors"
                              title="Edit">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          )}
                          {/* Delete own draft */}
                          {(isOwn || isStaff) && isDraft && (
                            <button
                              onClick={() => startTransition(() => deleteCostEntry(entry.id))}
                              disabled={isPending}
                              className="p-1.5 rounded-lg bg-[#F2F2F7] text-[#8E8E93] hover:bg-[#FFECEC] hover:text-[#FF3B30] disabled:opacity-40 transition-colors"
                              title="Delete">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Totals footer */}
        {period.entries.length > 0 && (
          <div className="px-5 py-3 bg-[#F2F2F7] border-t border-[#E5E5EA] flex justify-between items-center">
            <span className="text-[13px] text-[#8E8E93]">{period.entries.length} entries</span>
            <span className="text-[16px] font-bold text-black">{fmtAmount(totalAmount)}</span>
          </div>
        )}
      </div>

      {/* Award context */}
      {award && (
        <div className="mt-4 bg-white border border-[#E5E5EA] rounded-2xl p-5">
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-3">Award</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
            <div><span className="text-[#8E8E93]">Candidate:</span> <span className="font-medium">{award.candidate_name}</span></div>
            <div><span className="text-[#8E8E93]">Supplier:</span> <span className="font-medium">{award.supplier_name ?? '—'}</span></div>
            <div><span className="text-[#8E8E93]">Demand:</span> <span className="font-medium truncate">{award.demand_title}</span></div>
            {awardRate && <div><span className="text-[#8E8E93]">Rate:</span> <span className="font-medium">{fmtAmount(awardRate)}/{awardRateType}</span></div>}
          </div>
          <Link href={`/dashboard/awards/${award.id}`} className="inline-flex items-center gap-1 mt-3 text-[12px] text-[#007AFF] hover:underline">
            View Award
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </Link>
        </div>
      )}

      {canReview && (
        <p className="mt-3 text-[12px] text-[#8E8E93] text-center">
          Approve or reject each entry, then click &quot;Approve Period&quot; to proceed.
        </p>
      )}
    </div>
  );
}
