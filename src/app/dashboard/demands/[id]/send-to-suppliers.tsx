'use client';

import { useState, useTransition } from 'react';
import { sendToSuppliers } from '@/lib/actions/suppliers';
import type { Supplier, DemandSupplier, DemandSupplierStatus } from '@/types/database';

const STATUS_LABELS: Record<DemandSupplierStatus, string> = {
  sent: 'Sent',
  viewed: 'Viewed',
  submitted: 'Submitted',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<DemandSupplierStatus, string> = {
  sent: '#007AFF',
  viewed: '#FF9500',
  submitted: '#34C759',
  rejected: '#FF3B30',
};

interface SentEntry extends DemandSupplier {
  supplier: Supplier;
}

interface Props {
  demandId: string;
  availableSuppliers: Supplier[];
  sentEntries: SentEntry[];
}

export function SendToSuppliersPanel({ demandId, availableSuppliers, sentEntries }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sentSupplierIds = new Set(sentEntries.map(e => e.supplier_id));
  const unsent = availableSuppliers.filter(s => !sentSupplierIds.has(s.id) && s.status === 'active');

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function handleSend() {
    if (!selected.size) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await sendToSuppliers(demandId, Array.from(selected), deadline || null);
        setSelected(new Set());
        setDeadline('');
        setSuccess(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">
          Send to Suppliers
        </p>
      </div>

      {/* Already sent */}
      {sentEntries.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[13px] font-medium text-[#3C3C43] mb-2">Already sent</p>
          <div className="space-y-2">
            {sentEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 px-3 bg-[#F2F2F7] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                    style={{ backgroundColor: '#8E8E93' }}
                  >
                    {entry.supplier.company_name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-black leading-tight">
                      {entry.supplier.company_name}
                    </p>
                    {entry.deadline && (
                      <p className="text-[11px] text-[#8E8E93]">
                        Deadline: {new Date(entry.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: STATUS_COLORS[entry.status] + '18',
                    color: STATUS_COLORS[entry.status],
                  }}
                >
                  {STATUS_LABELS[entry.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {sentEntries.length > 0 && unsent.length > 0 && (
        <div className="mx-5 h-px bg-[#F2F2F7] mb-4" />
      )}

      {/* Unsent suppliers */}
      {unsent.length > 0 ? (
        <div className="px-5 pb-5">
          <p className="text-[13px] font-medium text-[#3C3C43] mb-2">Select suppliers</p>
          <div className="space-y-1.5 mb-4">
            {unsent.map(s => (
              <label
                key={s.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  selected.has(s.id) ? 'bg-[#007AFF]/8' : 'hover:bg-[#F2F2F7]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="w-4 h-4 accent-[#007AFF] cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-black leading-tight">{s.company_name}</p>
                  {s.specializations.length > 0 && (
                    <p className="text-[12px] text-[#8E8E93]">{s.specializations.join(' · ')}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* Deadline */}
          <div className="mb-4">
            <label className="text-[13px] font-medium text-[#3C3C43] block mb-1.5">
              Submission deadline (optional)
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-[14px] text-black outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors"
            />
          </div>

          {error && <p className="text-[13px] text-[#FF3B30] mb-3">{error}</p>}
          {success && <p className="text-[13px] text-[#34C759] mb-3">Sent successfully!</p>}

          <button
            onClick={handleSend}
            disabled={!selected.size || isPending}
            className="w-full py-3 rounded-[12px] text-white text-[15px] font-semibold transition-all disabled:opacity-40"
            style={{ backgroundColor: '#007AFF' }}
          >
            {isPending
              ? 'Sending…'
              : `Send to ${selected.size} Supplier${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      ) : unsent.length === 0 && sentEntries.length === 0 ? (
        <div className="px-5 pb-5">
          <p className="text-[14px] text-[#8E8E93]">
            No active suppliers yet.{' '}
            <a href="/dashboard/suppliers/new" className="text-[#007AFF] font-medium">Add one →</a>
          </p>
        </div>
      ) : unsent.length === 0 ? (
        <div className="px-5 pb-5">
          <p className="text-[14px] text-[#8E8E93]">All active suppliers have already received this demand.</p>
        </div>
      ) : null}
    </div>
  );
}
