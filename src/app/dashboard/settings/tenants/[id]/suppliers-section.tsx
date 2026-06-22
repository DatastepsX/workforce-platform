'use client';

import { useState, useTransition } from 'react';
import { assignSupplierToTenant, removeSupplierFromTenant, toggleTenantSupplier } from '@/lib/actions/tenants';

interface SupplierRow {
  id: string;
  company_name: string;
  email: string;
  contact_name: string | null;
  assigned: boolean;
  active: boolean;
}

interface Props {
  tenantId: string;
  suppliers: SupplierRow[];
}

export function SuppliersSection({ tenantId, suppliers: initialSuppliers }: Props) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtered = suppliers.filter(s =>
    s.company_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const assigned = filtered.filter(s => s.assigned);
  const unassigned = filtered.filter(s => !s.assigned);
  const visibleUnassigned = showAll ? unassigned : unassigned.slice(0, 5);

  function handleAssign(supplierId: string) {
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, assigned: true, active: true } : s));
    startTransition(async () => {
      const res = await assignSupplierToTenant(tenantId, supplierId);
      if (res?.error) {
        setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, assigned: false } : s));
      }
    });
  }

  function handleRemove(supplierId: string) {
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, assigned: false } : s));
    startTransition(async () => {
      const res = await removeSupplierFromTenant(tenantId, supplierId);
      if (res?.error) {
        setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, assigned: true } : s));
      }
    });
  }

  function handleToggleActive(supplierId: string, active: boolean) {
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, active } : s));
    startTransition(async () => {
      const res = await toggleTenantSupplier(tenantId, supplierId, active);
      if (res?.error) {
        setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, active: !active } : s));
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">
          Suppliers ({assigned.length} assigned)
        </p>
      </div>

      <input
        type="search"
        placeholder="Search suppliers…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 rounded-[8px] border border-[#E5E5EA] bg-[#F2F2F7] text-[14px] focus:outline-none focus:border-[#007AFF] mb-4"
      />

      {/* Assigned suppliers */}
      {assigned.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Assigned</p>
          <div className="divide-y divide-[#F2F2F7]">
            {assigned.map(s => (
              <div key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-black truncate">{s.company_name}</p>
                  {s.contact_name && <p className="text-[12px] text-[#8E8E93] truncate">{s.contact_name} · {s.email}</p>}
                  {!s.contact_name && <p className="text-[12px] text-[#8E8E93] truncate">{s.email}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Active toggle */}
                  <label className="relative inline-flex items-center cursor-pointer" title={s.active ? 'Active — can receive demands' : 'Inactive — hidden from demand send'}>
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={e => handleToggleActive(s.id, e.target.checked)}
                      disabled={isPending}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-5 bg-[#E5E5EA] rounded-full peer peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-3" />
                  </label>
                  <span className="text-[11px] font-medium w-12 text-right" style={{ color: s.active ? '#34C759' : '#8E8E93' }}>
                    {s.active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => handleRemove(s.id)}
                    disabled={isPending}
                    className="text-[12px] text-[#FF3B30] hover:opacity-70 transition-opacity disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned suppliers */}
      {unassigned.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">
            {search ? 'Other suppliers' : 'All suppliers'}
          </p>
          <div className="divide-y divide-[#F2F2F7]">
            {visibleUnassigned.map(s => (
              <div key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-[#3C3C43] truncate">{s.company_name}</p>
                  <p className="text-[12px] text-[#8E8E93] truncate">{s.email}</p>
                </div>
                <button
                  onClick={() => handleAssign(s.id)}
                  disabled={isPending}
                  className="text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity disabled:opacity-30 flex-shrink-0"
                >
                  + Assign
                </button>
              </div>
            ))}
          </div>
          {!showAll && unassigned.length > 5 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-2 text-[13px] text-[#007AFF] hover:opacity-70 transition-opacity"
            >
              Show {unassigned.length - 5} more…
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-[14px] text-[#8E8E93] text-center py-4">No suppliers match your search.</p>
      )}

      {suppliers.length === 0 && (
        <p className="text-[14px] text-[#8E8E93] text-center py-4">No suppliers in the platform yet.</p>
      )}
    </div>
  );
}
