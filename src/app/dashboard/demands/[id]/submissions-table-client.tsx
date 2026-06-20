'use client';

import { useState, useTransition, useMemo, useCallback } from 'react';
import { updateSubmissionStatus } from '@/lib/actions/submissions';
import { createEngagement } from '@/lib/actions/engagements';
import type { SubmissionStatus, UserRole } from '@/types/database';

const STATUS_META: Record<SubmissionStatus, { label: string; color: string }> = {
  proposed:    { label: 'Proposed',    color: '#8E8E93' },
  shortlisted: { label: 'Shortlisted', color: '#007AFF' },
  interview:   { label: 'Interview',   color: '#FF9500' },
  offer:       { label: 'Offer',       color: '#34C759' },
  hired:       { label: 'Hired',       color: '#34C759' },
  rejected:    { label: 'Rejected',    color: '#FF3B30' },
};

const STATUS_ORDER: SubmissionStatus[] = ['proposed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];

export interface SubmissionRow {
  id: string;
  demandId: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierEmail: string | null;
  source: 'supplier' | 'direct';
  status: SubmissionStatus;
  submittedAt: string;
  candidateName: string;
  candidateEmail: string | null;
  candidatePhone: string | null;
  candidateHeadline: string | null;
  candidateSkills: string[];
  candidateNotes: string | null;
  submissionNotes: string | null;
  proposedRate: number | null;
  rateType: string | null;
  cvSignedUrl: string | null;
  score: number | null;
  matchedSkills: string[];
}

function MatchBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[13px] text-[#C7C7CC]">—</span>;
  const color = score >= 80 ? '#34C759' : score >= 50 ? '#007AFF' : score >= 25 ? '#FF9500' : '#8E8E93';
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1.5 rounded-full bg-[#F2F2F7] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color }}>{score}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ backgroundColor: meta.color + '18', color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#F2F2F7] last:border-0">
      <span className="text-[13px] text-[#8E8E93] min-w-[110px] flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-[14px] text-black flex-1">{value}</span>
    </div>
  );
}

function countBusinessDays(start: string, end: string): number {
  try {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  } catch { return 0; }
}

const CONTRACT_RATE_DEFAULTS: Record<string, string> = {
  permanent: 'monthly', freelance: 'daily', contractor: 'daily', internship: 'monthly',
};

function CommissionPanel({
  row,
  demandTitle,
  demandStartDate,
  demandEndDate,
  contractType,
  onCommissioned,
}: {
  row: SubmissionRow;
  demandTitle: string;
  demandStartDate: string;
  demandEndDate: string;
  contractType: string;
  onCommissioned: () => void;
}) {
  const defaultRateType = row.rateType ?? CONTRACT_RATE_DEFAULTS[contractType] ?? 'daily';
  const [isPending, startTransition] = useTransition();
  const [startDate, setStartDate]   = useState(demandStartDate);
  const [endDate, setEndDate]       = useState(demandEndDate);
  const [rate, setRate]             = useState(String(row.proposedRate ?? ''));
  const [rateType, setRateType]     = useState(defaultRateType);
  const [currency, setCurrency]     = useState('EUR');
  const [notes, setNotes]           = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [totalOverride, setTotalOverride] = useState<string>('');
  const [priceLocked, setPriceLocked] = useState(false);

  const inp = 'w-full bg-[#F2F2F7] rounded-lg px-3 py-2 text-[13px] text-black placeholder:text-[#8E8E93] outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors';

  const calc = useMemo(() => {
    const r = parseFloat(rate) || 0;
    if (!r || !startDate || !endDate) return null;
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return null;
      const calendarDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
      const businessDays = countBusinessDays(startDate, endDate);
      const weekendDays = calendarDays - businessDays;
      let total = 0;
      let formula = '';
      if (rateType === 'daily') {
        total = businessDays * r;
        formula = `${businessDays} Arbeitstage × ${r.toLocaleString('de-DE')} ${currency}`;
      } else if (rateType === 'hourly') {
        total = businessDays * 8 * r;
        formula = `${businessDays} Tage × 8 Std. × ${r.toLocaleString('de-DE')} ${currency}`;
      } else if (rateType === 'monthly') {
        const months = businessDays / 21;
        total = months * r;
        formula = `${months.toFixed(1)} Monate × ${r.toLocaleString('de-DE')} ${currency}`;
      } else {
        total = r;
        formula = `Pauschal ${r.toLocaleString('de-DE')} ${currency}`;
      }
      // Auto-fill total override only if user hasn't manually locked it
      if (!priceLocked) {
        setTimeout(() => setTotalOverride(String(Math.round(total))), 0);
      }
      return { calendarDays, businessDays, weekendDays, total, formula };
    } catch { return null; }
  }, [startDate, endDate, rate, rateType, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  // For permanent: also show annual context
  const isPermanent = contractType === 'permanent';
  const annualSalary = isPermanent && rateType === 'monthly' && parseFloat(rate)
    ? parseFloat(rate) * 12
    : null;

  const submit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const overrideVal = parseFloat(totalOverride) || null;
      const calcVal = calc?.total ? Math.round(calc.total) : null;
      const finalTotal = overrideVal ?? calcVal;
      const isLocked = priceLocked || (overrideVal !== null && overrideVal !== calcVal);
      const result = await createEngagement({
        submissionId:   row.id,
        demandId:       row.demandId,
        demandTitle,
        candidateName:  row.candidateName,
        candidateEmail: row.candidateEmail,
        supplierId:     row.supplierId,
        supplierName:   row.supplierName,
        supplierEmail:  row.supplierEmail,
        startDate, endDate, rate, rateType, currency, notes,
        totalAmount:    finalTotal,
        priceLocked:    isLocked,
      });
      if (result.error) { setError(result.error); return; }
      onCommissioned();
    });
  }, [row, demandTitle, startDate, endDate, rate, rateType, currency, notes, totalOverride, priceLocked, calc, onCommissioned, startTransition]);

  const RATE_TYPE_LABELS: Record<string, string> = {
    daily: 'pro Tag', hourly: 'pro Stunde', monthly: 'pro Monat', fixed: 'Pauschal',
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#E5E5EA] space-y-3">
      <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px]">Beauftragung</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-[#8E8E93] mb-1 block">Startdatum</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="text-[11px] text-[#8E8E93] mb-1 block">Enddatum</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[11px] text-[#8E8E93] mb-1 block">Rate</label>
          <input type="number" min="0" value={rate} onChange={e => setRate(e.target.value)} placeholder="0" className={inp} />
        </div>
        <div>
          <label className="text-[11px] text-[#8E8E93] mb-1 block">Einheit</label>
          <select value={rateType} onChange={e => setRateType(e.target.value)} className={inp}>
            <option value="daily">pro Tag</option>
            <option value="hourly">pro Stunde</option>
            <option value="monthly">pro Monat</option>
            <option value="fixed">Pauschal</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-[#8E8E93] mb-1 block">Währung</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
            <option>EUR</option><option>CHF</option><option>GBP</option><option>USD</option>
          </select>
        </div>
      </div>

      {/* Live cost calculator */}
      {calc && (
        <div className="bg-gradient-to-br from-[#007AFF]/8 to-[#007AFF]/4 rounded-xl p-3.5 border border-[#007AFF]/15 space-y-3">
          <p className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-[0.5px]">Kostenkalkulation</p>

          {/* Days breakdown — only for time-based rates */}
          {rateType !== 'fixed' && (
            <div className="flex items-center gap-3">
              <div className="text-center flex-1">
                <p className="text-[18px] font-bold text-black leading-none">{calc.calendarDays}</p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">Kal.&nbsp;Tage</p>
              </div>
              <p className="text-[14px] text-[#C7C7CC]">−</p>
              <div className="text-center flex-1">
                <p className="text-[18px] font-bold text-[#8E8E93] leading-none">{calc.weekendDays}</p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">WE-Tage</p>
              </div>
              <p className="text-[14px] text-[#C7C7CC]">=</p>
              <div className="text-center flex-1">
                <p className="text-[18px] font-bold text-[#007AFF] leading-none">{calc.businessDays}</p>
                <p className="text-[10px] text-[#007AFF] mt-0.5">Arbeitstage</p>
              </div>
            </div>
          )}

          {/* Formula */}
          <div className="bg-white/60 rounded-lg px-3 py-2">
            <p className="text-[11px] text-[#8E8E93]">
              {calc.formula} <span className="text-[#007AFF]">{RATE_TYPE_LABELS[rateType] ?? ''}</span>
            </p>
          </div>

          {/* Total — editable override */}
          <div className="bg-white/80 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[#3C3C43]">Gesamtvolumen</p>
              {priceLocked && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FF9500]/15 text-[#FF9500]">Preis festgelegt</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#8E8E93]">{currency}</span>
              <input
                type="number"
                min="0"
                value={totalOverride}
                onChange={e => {
                  setTotalOverride(e.target.value);
                  const v = parseFloat(e.target.value);
                  setPriceLocked(!isNaN(v) && v !== Math.round(calc.total));
                }}
                className="flex-1 bg-[#F2F2F7] rounded-lg px-3 py-1.5 text-[18px] font-bold text-black outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors"
              />
            </div>
            {priceLocked && calc && (
              <p className="text-[10px] text-[#8E8E93]">
                Kalkulation: {currency} {Math.round(calc.total).toLocaleString('de-DE')} · Differenz: {currency} {(parseFloat(totalOverride) - calc.total).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
              </p>
            )}
          </div>

          {/* Permanent: annual context */}
          {isPermanent && annualSalary && (
            <div className="pt-2 border-t border-[#007AFF]/15">
              <p className="text-[11px] text-[#8E8E93]">
                Jahresgehalt: <span className="font-semibold text-[#3C3C43]">{currency} {annualSalary.toLocaleString('de-DE')}</span>
                <span className="ml-2">· Typische Vermittlungsgebühr 15–20%: <span className="font-semibold text-[#3C3C43]">{currency} {(annualSalary * 0.175).toLocaleString('de-DE', { maximumFractionDigits: 0 })}</span></span>
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="text-[11px] text-[#8E8E93] mb-1 block">Notizen (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className={inp + ' resize-none'} placeholder="Interne Notizen…" />
      </div>
      {error && <p className="text-[12px] text-[#FF3B30]">{error}</p>}
      <button
        onClick={submit}
        disabled={isPending}
        className="w-full py-2.5 rounded-[10px] text-white text-[14px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: '#34C759', boxShadow: '0 2px 8px rgba(52,199,89,0.3)' }}
      >
        {isPending ? 'Wird beauftragt…' : '✓ Beauftragung bestätigen'}
      </button>
    </div>
  );
}

function CandidateDrawer({
  row,
  demandTitle,
  demandStartDate,
  demandEndDate,
  contractType,
  canAct,
  onClose,
  onStatusChange,
}: {
  row: SubmissionRow;
  demandTitle: string;
  demandStartDate: string;
  demandEndDate: string;
  contractType: string;
  canAct: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: SubmissionStatus) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showCommission, setShowCommission] = useState(false);

  function moveStatus(status: SubmissionStatus) {
    startTransition(async () => {
      await updateSubmissionStatus(row.id, status, row.demandId);
      onStatusChange(row.id, status);
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] bg-white shadow-[−4px_0_32px_rgba(0,0,0,0.12)] z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#F2F2F7]">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={row.status} />
              {row.score !== null && (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: (row.score >= 80 ? '#34C759' : row.score >= 50 ? '#007AFF' : '#FF9500') + '18',
                    color: row.score >= 80 ? '#34C759' : row.score >= 50 ? '#007AFF' : '#FF9500',
                  }}
                >
                  {row.score}% match
                </span>
              )}
            </div>
            <h2 className="text-[22px] font-bold text-black leading-tight">{row.candidateName}</h2>
            {row.candidateHeadline && (
              <p className="text-[14px] text-[#8E8E93] mt-0.5">{row.candidateHeadline}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#8E8E93] hover:bg-[#E5E5EA] transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Contact info */}
          <div className="bg-[#F9F9FB] rounded-2xl px-4 py-1">
            <InfoRow label="Email" value={row.candidateEmail && (
              <a href={`mailto:${row.candidateEmail}`} className="text-[#007AFF] hover:underline">{row.candidateEmail}</a>
            )} />
            <InfoRow label="Phone" value={row.candidatePhone && (
              <a href={`tel:${row.candidatePhone}`} className="text-[#007AFF] hover:underline">{row.candidatePhone}</a>
            )} />
            <InfoRow label="Via" value={
              row.source === 'direct'
                ? <span className="font-semibold text-[#34C759]">Direct Application (Career Portal)</span>
                : row.supplierName
            } />
            <InfoRow label="Submitted on" value={new Date(row.submittedAt).toLocaleDateString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })} />
            {row.proposedRate && (
              <InfoRow label="Proposed Rate" value={
                <span className="font-semibold text-[#007AFF]">
                  €{row.proposedRate.toLocaleString()} <span className="font-normal text-[#8E8E93] text-[12px]">/ {row.rateType ?? 'day'}</span>
                </span>
              } />
            )}
          </div>

          {/* Skills */}
          {row.candidateSkills.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {row.candidateSkills.map(skill => {
                  const isMatch = row.matchedSkills.includes(skill);
                  return (
                    <span
                      key={skill}
                      className="text-[13px] px-3 py-1 rounded-full font-medium"
                      style={
                        isMatch
                          ? { backgroundColor: '#007AFF18', color: '#007AFF' }
                          : { backgroundColor: '#F2F2F7', color: '#8E8E93' }
                      }
                    >
                      {skill}
                    </span>
                  );
                })}
              </div>
              {row.matchedSkills.length > 0 && (
                <p className="text-[11px] text-[#8E8E93] mt-2">
                  {row.matchedSkills.length} of {row.candidateSkills.length} skills match the demand
                </p>
              )}
            </div>
          )}

          {/* Match score detail */}
          {row.score !== null && (
            <div>
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Skill Match</p>
              <div className="bg-[#F9F9FB] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-2 rounded-full bg-[#E5E5EA] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${row.score}%`,
                        backgroundColor: row.score >= 80 ? '#34C759' : row.score >= 50 ? '#007AFF' : '#FF9500',
                      }}
                    />
                  </div>
                  <span className="text-[16px] font-bold tabular-nums text-black">{row.score}%</span>
                </div>
                <p className="text-[12px] text-[#8E8E93]">
                  Based on skill overlap · AI-powered ranking coming soon
                </p>
              </div>
            </div>
          )}

          {/* CV */}
          {row.cvSignedUrl && (
            <div>
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">CV / Resume</p>
              <a
                href={row.cvSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-[#F9F9FB] rounded-2xl px-4 py-3.5 hover:bg-[#F2F2F7] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4.5 h-4.5 text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-black">Download CV</p>
                  <p className="text-[12px] text-[#8E8E93]">PDF document</p>
                </div>
                <svg className="w-4 h-4 text-[#C7C7CC] group-hover:text-[#007AFF] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          )}

          {/* Submission notes */}
          {row.submissionNotes && (
            <div>
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Supplier Notes</p>
              <div className="bg-[#F9F9FB] rounded-2xl px-4 py-3.5">
                <p className="text-[14px] text-black leading-relaxed whitespace-pre-wrap">{row.submissionNotes}</p>
              </div>
            </div>
          )}

          {/* Internal candidate notes */}
          {row.candidateNotes && (
            <div>
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Candidate Profile Notes</p>
              <div className="bg-[#F9F9FB] rounded-2xl px-4 py-3.5">
                <p className="text-[14px] text-[#3C3C43] leading-relaxed whitespace-pre-wrap">{row.candidateNotes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer — status actions (scrollable so commission panel button stays visible) */}
        {canAct && (
          <div className="overflow-y-auto max-h-[60vh] px-6 py-4 border-t border-[#F2F2F7] bg-[#F9F9FB]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px]">Move to Stage</p>
              {row.status !== 'hired' && (
                <button
                  onClick={() => setShowCommission(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                    showCommission
                      ? 'bg-[#34C759]/15 text-[#34C759]'
                      : 'bg-[#34C759]/10 text-[#34C759] hover:bg-[#34C759]/20'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4" /><rect x="3" y="4" width="18" height="18" rx="2" />
                  </svg>
                  Commission
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.filter(s => s !== row.status).map(s => {
                const m = STATUS_META[s];
                return (
                  <button
                    key={s}
                    onClick={() => moveStatus(s)}
                    disabled={isPending}
                    className="text-[13px] font-medium px-4 py-2 rounded-[10px] transition-all disabled:opacity-40 flex items-center gap-1.5"
                    style={{ backgroundColor: m.color + '14', color: m.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </button>
                );
              })}
            </div>
            {showCommission && (
              <CommissionPanel
                row={row}
                demandTitle={demandTitle}
                demandStartDate={demandStartDate}
                demandEndDate={demandEndDate}
                contractType={contractType}
                onCommissioned={() => {
                  onStatusChange(row.id, 'hired');
                  setShowCommission(false);
                }}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

const STATUS_ALL_FILTER: { value: SubmissionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
];

function InlineSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 pr-7 rounded-lg bg-[#F2F2F7] text-[12px] text-black placeholder:text-[#8E8E93] border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white focus:outline-none transition-colors w-44"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#C7C7CC] flex items-center justify-center hover:bg-[#8E8E93] transition-colors">
          <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}

export function SubmissionsTableClient({
  rows: initialRows,
  role,
  demandTitle,
  demandStartDate,
  demandEndDate,
  contractType,
}: {
  rows: SubmissionRow[];
  demandSkills: string[];
  role: UserRole;
  demandTitle: string;
  demandStartDate: string;
  demandEndDate: string;
  contractType: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<SubmissionRow | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'direct' | 'supplier'>('all');
  const canAct = role === 'recruiter' || role === 'admin';
  const isFiltered = q !== '' || statusFilter !== 'all' || sourceFilter !== 'all';
  function resetFilters() { setQ(''); setStatusFilter('all'); setSourceFilter('all'); }

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (sourceFilter === 'direct' && r.source !== 'direct') return false;
      if (sourceFilter === 'supplier' && r.source !== 'supplier') return false;
      if (!term) return true;
      return r.candidateName.toLowerCase().includes(term) ||
        (r.candidateEmail || '').toLowerCase().includes(term) ||
        (r.candidateHeadline || '').toLowerCase().includes(term) ||
        r.candidateSkills.join(' ').toLowerCase().includes(term);
    });
  }, [rows, q, statusFilter, sourceFilter]);

  function handleStatusChange(id: string, status: SubmissionStatus) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="w-10 h-10 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-[15px] font-semibold text-black mb-1">No candidates submitted yet</p>
        <p className="text-[13px] text-[#8E8E93]">Suppliers will submit candidates once they respond to this demand.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#F2F2F7]">
          <InlineSearch value={q} onChange={setQ} placeholder="Search candidates…" />
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            <div className="flex items-center gap-1 bg-[#F2F2F7] rounded-lg px-1.5 py-1">
              <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-0.5">Stage</span>
              {STATUS_ALL_FILTER.slice(0, 5).map(opt => (
                <button key={opt.value} onClick={() => setStatusFilter(opt.value as SubmissionStatus | 'all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${statusFilter === opt.value ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
                >
                  {opt.label}
                </button>
              ))}
              {STATUS_ALL_FILTER.slice(5).map(opt => (
                <button key={opt.value} onClick={() => setStatusFilter(opt.value as SubmissionStatus | 'all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${statusFilter === opt.value ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-[#F2F2F7] rounded-lg px-1.5 py-1">
              <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wide mr-0.5">Via</span>
              {(['all', 'supplier', 'direct'] as const).map(v => (
                <button key={v} onClick={() => setSourceFilter(v)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors capitalize ${sourceFilter === v ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
                >
                  {v === 'all' ? 'All' : v === 'direct' ? 'Direct' : 'Supplier'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-[#F2F2F7]">
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-5 py-3">Candidate</th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[130px]">Via</th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[110px]" title="Skill overlap with demand requirements">
                  Match ✦
                </th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[150px]">Skills</th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[110px]">Rate</th>
                <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[110px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7]">
              {filtered.length === 0 && isFiltered ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center">
                    <p className="text-[13px] text-[#8E8E93] mb-2">No candidates match your filter.</p>
                    <button onClick={resetFilters} className="text-[13px] font-medium text-[#007AFF] hover:underline">Clear filters</button>
                  </td>
                </tr>
              ) : null}
              {filtered.map(row => {
                const isRejected = row.status === 'rejected';
                const isSelected = selected?.id === row.id;
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(isSelected ? null : row)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#007AFF]/5'
                        : isRejected
                        ? 'opacity-50 hover:bg-[#F9F9FB]'
                        : 'hover:bg-[#F9F9FB]'
                    }`}
                  >
                    <td className="px-5 py-3.5 align-top">
                      <p className="text-[14px] font-semibold text-black">{row.candidateName}</p>
                      {row.candidateHeadline && (
                        <p className="text-[12px] text-[#8E8E93] mt-0.5 truncate max-w-[200px]">{row.candidateHeadline}</p>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      {row.source === 'direct' ? (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#34C759]/12 text-[#34C759]">
                          Direct
                        </span>
                      ) : (
                        <span className="text-[13px] text-[#3C3C43]">{row.supplierName ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <MatchBadge score={row.score} />
                    </td>
                    <td className="px-3 py-3.5 align-middle w-[150px] max-w-[150px]">
                      {row.candidateSkills.length > 0 ? (
                        <div className="flex items-center gap-1 overflow-hidden">
                          {row.candidateSkills.slice(0, 3).map(skill => {
                            const isMatch = row.matchedSkills.includes(skill);
                            return (
                              <span
                                key={skill}
                                className="text-[10px] px-1.5 py-0 rounded-full font-medium whitespace-nowrap flex-shrink-0"
                                style={
                                  isMatch
                                    ? { backgroundColor: '#007AFF18', color: '#007AFF' }
                                    : { backgroundColor: '#F2F2F7', color: '#8E8E93' }
                                }
                              >
                                {skill}
                              </span>
                            );
                          })}
                          {row.candidateSkills.length > 3 && (
                            <span className="text-[10px] text-[#C7C7CC] flex-shrink-0">+{row.candidateSkills.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[12px] text-[#C7C7CC]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      {row.proposedRate ? (
                        <span className="text-[14px] font-semibold text-black">
                          €{row.proposedRate.toLocaleString()}
                          <span className="text-[11px] font-normal text-[#8E8E93] ml-1">/{row.rateType ?? 'day'}</span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#C7C7CC]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: STATUS_META[row.status].color + '18', color: STATUS_META[row.status].color }}
                        >
                          {STATUS_META[row.status].label}
                        </span>
                        <svg className="w-3.5 h-3.5 text-[#C7C7CC] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-[#F2F2F7] flex items-center justify-between">
          <span className="text-[11px] text-[#C7C7CC]">✦ Match = skill overlap · Click a row to view details{canAct ? ' and change status' : ''}</span>
          <span className="text-[11px] text-[#C7C7CC]">{filtered.length} of {rows.length}</span>
        </div>
      </div>

      {selected && (
        <CandidateDrawer
          row={selected}
          demandTitle={demandTitle}
          demandStartDate={demandStartDate}
          demandEndDate={demandEndDate}
          contractType={contractType}
          canAct={canAct}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}
