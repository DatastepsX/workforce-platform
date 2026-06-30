'use client';

import { useState, useTransition } from 'react';
import { toggleTenantSupplierCategory } from '@/lib/actions/job-descriptions';
import type { SupplierCategory } from '@/types/database';

interface Props {
  tenantId: string;
  allCategories: SupplierCategory[];
  assignedCategoryIds: string[];
}

export function SupplierCategoriesSection({ tenantId, allCategories, assignedCategoryIds: initial }: Props) {
  const [assigned, setAssigned] = useState<Set<string>>(new Set(initial));
  const [isPending, startTransition] = useTransition();

  function toggle(categoryId: string) {
    const isAssigned = assigned.has(categoryId);
    setAssigned(prev => {
      const next = new Set(prev);
      if (isAssigned) next.delete(categoryId); else next.add(categoryId);
      return next;
    });
    startTransition(async () => {
      await toggleTenantSupplierCategory(tenantId, categoryId, !isAssigned);
    });
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Supplier Categories</p>
          <p className="text-[11px] text-[#8E8E93] mt-0.5">Active categories determine which suppliers auto-assign to demands</p>
        </div>
      </div>

      {allCategories.length === 0 ? (
        <p className="text-[13px] text-[#8E8E93]">No supplier categories configured yet. Add them in Settings → Supplier Categories.</p>
      ) : (
        <div className="divide-y divide-[#F2F2F7]">
          {allCategories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-black">{cat.name}</p>
                {cat.description && <p className="text-[12px] text-[#8E8E93] truncate">{cat.description}</p>}
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={assigned.has(cat.id)}
                  onChange={() => toggle(cat.id)}
                  disabled={isPending}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-[#E5E5EA] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
