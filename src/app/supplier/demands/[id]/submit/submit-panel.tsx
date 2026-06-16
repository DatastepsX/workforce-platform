'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { submitCandidates } from '@/lib/actions/submissions';
import type { CandidateSubmissionInput } from '@/lib/actions/submissions';
import type { SupplierCandidate } from '@/types/database';

interface Props {
  demandId: string;
  candidates: SupplierCandidate[];
  submittedIds: string[];
}

const RATE_TYPES = [
  { value: 'daily',   label: '/ day' },
  { value: 'hourly',  label: '/ hour' },
  { value: 'monthly', label: '/ month' },
  { value: 'fixed',   label: 'fixed' },
];

export function SubmitPanel({ demandId, candidates, submittedIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rates, setRates] = useState<Record<string, { amount: string; type: string }>>({});
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const unsubmitted = candidates.filter(c => !submittedIds.includes(c.id));

  function toggleCandidate(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Init rate entry when selecting
    if (!rates[id]) setRates(prev => ({ ...prev, [id]: { amount: '', type: 'daily' } }));
  }

  function setRate(id: string, field: 'amount' | 'type', value: string) {
    setRates(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function handleSubmit() {
    if (!selected.size) return;
    setResult(null);
    const submissions: CandidateSubmissionInput[] = Array.from(selected).map(id => ({
      id,
      proposed_rate: rates[id]?.amount ? parseFloat(rates[id].amount) : null,
      rate_type: rates[id]?.type ?? 'daily',
    }));
    startTransition(async () => {
      const res = await submitCandidates(demandId, submissions, notes);
      setResult(res ?? { success: true });
      if (res?.success) { setSelected(new Set()); setNotes(''); }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide">
          Your Candidate Pool ({unsubmitted.length})
        </h2>
        <Link
          href={`/supplier/candidates/new?return_to=/supplier/demands/${demandId}/submit`}
          className="text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
        >
          + Add Candidate
        </Link>
      </div>

      {unsubmitted.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[17px] font-semibold text-black mb-1">No candidates yet</p>
          <p className="text-[15px] text-[#8E8E93] mb-4">Add candidates to your pool to submit them for this demand.</p>
          <Link
            href={`/supplier/candidates/new?return_to=/supplier/demands/${demandId}/submit`}
            className="inline-block px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold"
            style={{ backgroundColor: '#007AFF' }}
          >
            Add First Candidate
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] divide-y divide-[#F2F2F7] mb-4">
            {unsubmitted.map(c => {
              const isSelected = selected.has(c.id);
              const rate = rates[c.id];
              return (
                <div key={c.id}>
                  {/* Candidate row */}
                  <button
                    onClick={() => toggleCandidate(c.id)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#F2F2F7]/50 transition-colors"
                  >
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: isSelected ? '#007AFF' : '#C7C7CC',
                        backgroundColor: isSelected ? '#007AFF' : 'transparent',
                      }}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-black">{c.name}</p>
                      {c.headline && <p className="text-[13px] text-[#8E8E93] truncate">{c.headline}</p>}
                      {c.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.skills.slice(0, 4).map(s => (
                            <span key={s} className="text-[10px] bg-[#007AFF]/10 text-[#007AFF] px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                          {c.skills.length > 4 && <span className="text-[10px] text-[#8E8E93]">+{c.skills.length - 4}</span>}
                        </div>
                      )}
                    </div>
                    {c.cv_path && <span className="flex-shrink-0 text-[11px] text-[#34C759] font-medium">CV</span>}
                  </button>

                  {/* Rate input — shown when selected */}
                  {isSelected && (
                    <div className="px-5 pb-4 flex items-center gap-2 bg-[#F2F2F7]/40">
                      <span className="text-[13px] text-[#8E8E93] flex-shrink-0">Proposed rate:</span>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[14px] text-[#8E8E93]">€</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          placeholder="0"
                          value={rate?.amount ?? ''}
                          onChange={e => setRate(c.id, 'amount', e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-24 h-8 px-2 rounded-lg border border-[#E5E5EA] bg-white text-[14px] font-medium focus:outline-none focus:border-[#007AFF] text-right"
                        />
                        <select
                          value={rate?.type ?? 'daily'}
                          onChange={e => setRate(c.id, 'type', e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="h-8 px-2 rounded-lg border border-[#E5E5EA] bg-white text-[13px] text-[#3C3C43] focus:outline-none focus:border-[#007AFF]"
                        >
                          {RATE_TYPES.map(rt => (
                            <option key={rt.value} value={rt.value}>{rt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notes */}
          {selected.size > 0 && (
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">
                Notes for recruiter (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any context about these candidates..."
                rows={3}
                className="w-full px-4 py-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 resize-none transition-all"
              />
            </div>
          )}

          {result?.error && <p className="text-[14px] text-[#FF3B30] mb-3 px-1">{result.error}</p>}
          {result?.success && <p className="text-[14px] text-[#34C759] font-medium mb-3 px-1">✓ Candidates submitted successfully!</p>}

          <button
            onClick={handleSubmit}
            disabled={selected.size === 0 || isPending}
            className="w-full py-3.5 rounded-2xl text-white text-[16px] font-semibold transition-all disabled:opacity-40"
            style={{ backgroundColor: '#007AFF' }}
          >
            {isPending ? 'Submitting…' : selected.size === 0 ? 'Select candidates to submit' : `Submit ${selected.size} candidate${selected.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}

      <Link href="/supplier/candidates" className="mt-4 block text-center text-[13px] text-[#8E8E93] hover:text-[#007AFF] transition-colors">
        Manage your candidate pool →
      </Link>
    </div>
  );
}
