'use client';

import { useState, useTransition } from 'react';
import { deleteTenant } from '@/lib/actions/tenants';

interface Props {
  tenantId: string;
  tenantName: string;
}

export function DeleteTenantButton({ tenantId, tenantName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteTenant(tenantId);
    });
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[14px] font-semibold transition-colors"
        style={{ backgroundColor: '#FF3B3010', color: '#FF3B30' }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
        </svg>
        Delete Client
      </button>
    );
  }

  return (
    <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-2xl p-5">
      <p className="text-[15px] font-semibold text-black mb-1">Delete &quot;{tenantName}&quot;?</p>
      <p className="text-[13px] text-[#8E8E93] mb-4">
        This will permanently delete the tenant, all its workflow config, role labels, supplier assignments, and all demands + submissions associated with it. Users will be unassigned but not deleted.
      </p>
      <p className="text-[13px] font-medium text-[#3C3C43] mb-2">
        Type <span className="font-mono font-bold">{tenantName}</span> to confirm:
      </p>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={tenantName}
        className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] focus:outline-none focus:border-[#FF3B30] focus:ring-2 focus:ring-[#FF3B30]/20 mb-4"
      />
      <div className="flex gap-3">
        <button
          onClick={handleDelete}
          disabled={input !== tenantName || isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: '#FF3B30' }}
        >
          {isPending ? 'Deleting…' : 'Delete permanently'}
        </button>
        <button
          onClick={() => { setConfirming(false); setInput(''); }}
          className="px-5 py-2.5 rounded-[10px] text-[14px] font-medium text-[#3C3C43] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
