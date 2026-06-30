'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CostItemWithMeta } from '@/lib/actions/cost-items';
import type { CostItemCategory, CostItemContractType } from '@/types/database';

const CONTRACT_TYPES: { value: CostItemContractType; label: string; desc: string }[] = [
  { value: 'temp',        label: 'Temporary Staffing', desc: 'Hourly/daily temp workers' },
  { value: 'contracting', label: 'Contracting',        desc: 'PSC, Umbrella, Self-employed' },
  { value: 'sow',         label: 'Statement of Work',  desc: 'Milestones & deliverables' },
  { value: 'perm',        label: 'Permanent',          desc: 'Direct placement' },
];

const inputCls = 'w-full px-3 py-2 bg-[#F2F2F7] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30';
const selectCls = inputCls;

interface Props {
  categories: CostItemCategory[];
  item?: CostItemWithMeta;
  onSave: (formData: FormData) => Promise<void>;
}

export function CostItemForm({ categories, item, onSave }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedContractTypes, setSelectedContractTypes] = useState<CostItemContractType[]>(item?.contract_types ?? []);

  function toggleCT(ct: CostItemContractType) {
    setSelectedContractTypes(prev => prev.includes(ct) ? prev.filter(x => x !== ct) : [...prev, ct]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    // Replace contract_types with our state (checkboxes not fully reliable with FormData)
    fd.delete('contract_types');
    selectedContractTypes.forEach(ct => fd.append('contract_types', ct));

    startTransition(async () => {
      try {
        await onSave(fd);
        router.push('/dashboard/settings/cost-items');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 bg-[#FFF0F0] border border-[#FF3B30]/30 rounded-xl text-[13px] text-[#FF3B30]">{error}</div>}

      {/* Basic Info */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4">
        <h2 className="text-[15px] font-semibold text-black">Basic Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Code <span className="text-[#FF3B30]">*</span></label>
            <input name="code" required defaultValue={item?.code} placeholder="e.g. REG_HRS" className={inputCls} style={{ fontFamily: 'monospace' }} />
            <p className="mt-1 text-[11px] text-[#8E8E93]">Unique identifier (uppercase, underscores)</p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Name <span className="text-[#FF3B30]">*</span></label>
            <input name="name" required defaultValue={item?.name} placeholder="e.g. Regular Hours" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Description</label>
          <textarea name="description" rows={2} defaultValue={item?.description ?? ''} placeholder="Explain when this cost item applies…" className={inputCls + ' resize-none'} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Category</label>
            <select name="category_id" defaultValue={item?.category_id ?? ''} className={selectCls}>
              <option value="">— None —</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Billing Type</label>
            <select name="billing_type" defaultValue={item?.billing_type ?? ''} className={selectCls}>
              <option value="">— None —</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="fixed">Fixed</option>
              <option value="percentage">Percentage</option>
              <option value="milestone">Milestone</option>
              <option value="unit">Unit</option>
            </select>
          </div>
        </div>
      </section>

      {/* Contract Types */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-black">Applicable Contract Types</h2>
          <p className="text-[12px] text-[#8E8E93]">Select which contract types can use this cost item</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CONTRACT_TYPES.map(ct => (
            <label key={ct.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedContractTypes.includes(ct.value) ? 'border-[#007AFF] bg-[#E8F4FD]' : 'border-[#E5E5EA] hover:bg-[#F9F9FB]'}`}>
              <input
                type="checkbox"
                className="mt-0.5 accent-[#007AFF]"
                checked={selectedContractTypes.includes(ct.value)}
                onChange={() => toggleCT(ct.value)}
              />
              <div>
                <div className="text-[13px] font-semibold text-black">{ct.label}</div>
                <div className="text-[11px] text-[#8E8E93]">{ct.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Financial & Tax */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4">
        <h2 className="text-[15px] font-semibold text-black">Financial & Tax</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Tax Treatment</label>
            <select name="tax_treatment" defaultValue={item?.tax_treatment ?? 'standard'} className={selectCls}>
              <option value="standard">Standard</option>
              <option value="exempt">Exempt</option>
              <option value="reverse_charge">Reverse Charge</option>
              <option value="zero_rated">Zero Rated</option>
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" name="markup_eligible" value="true" defaultChecked={item?.markup_eligible ?? false} className="accent-[#007AFF]" />
              <span className="text-[13px] font-medium text-black">Markup Eligible</span>
            </label>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" name="pass_through" value="true" defaultChecked={item?.pass_through ?? false} className="accent-[#007AFF]" />
              <span className="text-[13px] font-medium text-black">Pass-through</span>
            </label>
          </div>
        </div>
      </section>

      {/* SAP Integration */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-black">SAP Integration</h2>
          <p className="text-[12px] text-[#8E8E93]">Define how this cost item maps into SAP FI/CO</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">SAP GL Account</label>
            <input name="sap_gl_account" defaultValue={item?.sap_gl_account ?? ''} placeholder="e.g. 415000" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Cost Object Type</label>
            <select name="sap_cost_object_type" defaultValue={item?.sap_cost_object_type ?? ''} className={selectCls}>
              <option value="">— None —</option>
              <option value="cost_center">Cost Center</option>
              <option value="wbs_element">WBS Element (Project)</option>
              <option value="internal_order">Internal Order</option>
              <option value="profit_center">Profit Center</option>
            </select>
          </div>
        </div>
      </section>

      {/* Availability */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-black">Availability & Effective Dates</h2>
          <p className="text-[12px] text-[#8E8E93]">Leave countries blank to make globally available. Comma-separate ISO codes (e.g. DE, AT, CH)</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Countries</label>
            <input name="countries" defaultValue={item?.countries?.join(', ') ?? ''} placeholder="e.g. DE, AT, CH" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Effective From</label>
            <input type="date" name="effective_from" defaultValue={item?.effective_from ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Effective To</label>
            <input type="date" name="effective_to" defaultValue={item?.effective_to ?? ''} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="active" value="true" defaultChecked={item?.active ?? true} className="accent-[#007AFF]" />
          <span className="text-[13px] font-medium text-black">Active</span>
          <span className="text-[11px] text-[#8E8E93]">— inactive items are hidden from timesheet/expense entry</span>
        </label>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || selectedContractTypes.length === 0}
          className="px-5 py-2.5 rounded-xl text-white text-[14px] font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#007AFF' }}
        >
          {isPending ? 'Saving…' : item ? 'Save Changes' : 'Create Cost Item'}
        </button>
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-[#F2F2F7] text-[#3C3C43]">
          Cancel
        </button>
        {selectedContractTypes.length === 0 && (
          <span className="text-[12px] text-[#FF9500]">Select at least one contract type</span>
        )}
      </div>
    </form>
  );
}
