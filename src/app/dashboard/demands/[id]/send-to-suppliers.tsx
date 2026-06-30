'use client';

import { useState, useTransition } from 'react';
import { sendToSuppliers, assignSuppliersForReview, removePreassignedSupplier } from '@/lib/actions/suppliers';
import type { Supplier, DemandSupplier, DemandSupplierStatus } from '@/types/database';

const STATUS_LABELS: Record<DemandSupplierStatus, string> = {
  sent: 'Sent',
  viewed: 'Viewed',
  submitted: 'Submitted',
  rejected: 'Rejected',
  preassigned: 'Pre-assigned',
};

const STATUS_COLORS: Record<DemandSupplierStatus, string> = {
  sent: '#007AFF',
  viewed: '#FF9500',
  submitted: '#34C759',
  rejected: '#FF3B30',
  preassigned: '#5856D6',
};

interface SentEntry extends DemandSupplier {
  supplier: Supplier;
}

interface Props {
  demandId: string;
  availableSuppliers: Supplier[];
  sentEntries: SentEntry[];
  canSend: boolean;    // demand is at sourcing — full send with email
  canAssign: boolean;  // demand is at pending_review/pending_approval — pre-assign without email
  canRemove: boolean;  // can remove pre-assigned suppliers
  lockedReason?: string | null;
}

export function SendToSuppliersPanel({ demandId, availableSuppliers, sentEntries, canSend, canAssign, canRemove, lockedReason }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState('');
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sentSupplierIds = new Set(sentEntries.map(e => e.supplier_id));

  // At sourcing: pre-assigned suppliers are selectable (they'll get emailed)
  // At pending_review: only truly unsent suppliers appear
  const preassigned = sentEntries.filter(e => e.status === 'preassigned');
  const alreadySent = sentEntries.filter(e => e.status !== 'preassigned');

  const unsent = availableSuppliers.filter(s => {
    if (s.status !== 'active') return false;
    if (!sentSupplierIds.has(s.id)) return true;
    // At sourcing, include pre-assigned in the selectable list
    if (canSend) return sentEntries.find(e => e.supplier_id === s.id)?.status === 'preassigned';
    return false;
  });

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function handleAction() {
    if (!selected.size) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        if (canSend) {
          await sendToSuppliers(demandId, Array.from(selected), deadline || null);
        } else {
          await assignSuppliersForReview(demandId, Array.from(selected));
        }
        setSelected(new Set());
        setDeadline('');
        setSuccess(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    });
  }

  function handleRemove(supplierId: string) {
    setError(null);
    setRemovingId(supplierId);
    startTransition(async () => {
      try {
        await removePreassignedSupplier(demandId, supplierId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove supplier');
      } finally {
        setRemovingId(null);
      }
    });
  }

  const isActive = canSend || canAssign;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">
          {canAssign && !canSend ? 'Pre-assign Suppliers' : 'Send to Suppliers'}
        </p>
        {canAssign && !canSend && (
          <p className="text-[12px] text-[#8E8E93] mt-0.5">
            Suppliers will be notified when the demand goes live for sourcing.
          </p>
        )}
      </div>

      {/* Already sent (emailed) */}
      {alreadySent.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[13px] font-medium text-[#3C3C43] mb-2">Already sent</p>
          <div className="space-y-2">
            {alreadySent.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 px-3 bg-[#F2F2F7] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: '#8E8E93' }}>
                    {entry.supplier.company_name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-black leading-tight">{entry.supplier.company_name}</p>
                    {entry.deadline && (
                      <p className="text-[11px] text-[#8E8E93]">
                        Deadline: {new Date(entry.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[entry.status] + '18', color: STATUS_COLORS[entry.status] }}>
                  {STATUS_LABELS[entry.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-assigned (pending_review / pending_approval stage — not yet emailed) */}
      {preassigned.length > 0 && !canSend && (
        <div className="px-5 pb-4">
          <p className="text-[13px] font-medium text-[#3C3C43] mb-2">Pre-assigned</p>
          <div className="space-y-2">
            {preassigned.map(entry => {
              const isRemoving = removingId === entry.supplier_id;
              return (
                <div key={entry.id} className="flex items-center justify-between py-2 px-3 bg-[#F2F2F7] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: '#5856D6' }}>
                      {entry.supplier.company_name[0].toUpperCase()}
                    </div>
                    <p className="text-[14px] font-medium text-black leading-tight">{entry.supplier.company_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#5856D6' + '18', color: '#5856D6' }}>
                      Pre-assigned
                    </span>
                    {canRemove && (
                      <button
                        onClick={() => handleRemove(entry.supplier_id)}
                        disabled={isPending}
                        title="Remove pre-assigned supplier"
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                        style={{ backgroundColor: '#FF3B3012', color: '#FF3B30' }}
                      >
                        {isRemoving ? (
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      {isActive && (alreadySent.length > 0 || (preassigned.length > 0 && !canSend)) && unsent.length > 0 && (
        <div className="mx-5 h-px bg-[#F2F2F7] mb-4" />
      )}

      {/* Locked */}
      {!isActive ? (
        <div className="px-5 pb-5">
          <div className="flex items-start gap-2.5 bg-[#FF9500]/8 border border-[#FF9500]/20 rounded-xl px-3.5 py-3">
            <svg className="w-4 h-4 text-[#FF9500] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="text-[13px] text-[#3C3C43] leading-relaxed">
              {lockedReason ?? 'Sending is not available at this stage.'}
            </p>
          </div>
        </div>
      ) : unsent.length > 0 ? (
        <div className="px-5 pb-5">
          <p className="text-[13px] font-medium text-[#3C3C43] mb-2">
            {canSend && preassigned.length > 0 ? 'Select suppliers to notify' : 'Select suppliers'}
          </p>
          <div className="space-y-1.5 mb-4">
            {unsent.map(s => {
              const isPreassigned = canSend && sentEntries.find(e => e.supplier_id === s.id)?.status === 'preassigned';
              return (
                <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${selected.has(s.id) ? 'bg-[#007AFF]/8' : 'hover:bg-[#F2F2F7]'}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="w-4 h-4 accent-[#007AFF] cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-medium text-black leading-tight">{s.company_name}</p>
                      {isPreassigned && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#5856D6' + '18', color: '#5856D6' }}>pre-assigned</span>
                      )}
                    </div>
                    {s.specializations?.length > 0 && (
                      <p className="text-[12px] text-[#8E8E93]">{s.specializations.join(' · ')}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {canSend && (
            <div className="mb-4">
              <label className="text-[13px] font-medium text-[#3C3C43] block mb-1.5">Submission deadline (optional)</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] text-black outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors"
              />
            </div>
          )}

          {error && <p className="text-[13px] text-[#FF3B30] mb-3">{error}</p>}
          {success && (
            <p className="text-[13px] text-[#34C759] mb-3">
              {canSend ? 'Sent successfully!' : 'Suppliers pre-assigned successfully!'}
            </p>
          )}

          <button
            onClick={handleAction}
            disabled={!selected.size || isPending}
            className="w-full py-3 rounded-[12px] text-white text-[15px] font-semibold transition-all disabled:opacity-40"
            style={{ backgroundColor: canSend ? '#007AFF' : '#5856D6' }}
          >
            {isPending
              ? (canSend ? 'Sending…' : 'Assigning…')
              : canSend
              ? `Send to ${selected.size} Supplier${selected.size !== 1 ? 's' : ''}`
              : `Pre-assign ${selected.size} Supplier${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      ) : unsent.length === 0 && sentEntries.length === 0 ? (
        <div className="px-5 pb-5">
          <p className="text-[14px] text-[#8E8E93]">
            No active suppliers yet.{' '}
            <a href="/dashboard/suppliers/new" className="text-[#007AFF] font-medium">Add one →</a>
          </p>
        </div>
      ) : (
        <div className="px-5 pb-5">
          <p className="text-[14px] text-[#8E8E93]">
            {canSend ? 'All active suppliers have already received this demand.' : 'All active suppliers have been pre-assigned.'}
          </p>
        </div>
      )}
    </div>
  );
}
