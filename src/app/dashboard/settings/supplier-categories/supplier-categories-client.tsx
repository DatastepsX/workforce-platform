'use client';

import { useState, useTransition } from 'react';
import { upsertSupplierCategory, deleteSupplierCategory, toggleSupplierCategoryMember } from '@/lib/actions/job-descriptions';
import type { SupplierCategory, Supplier } from '@/types/database';

const INP = 'w-full px-3 py-2 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]';

interface Props {
  categories: SupplierCategory[];
  suppliers: Pick<Supplier, 'id' | 'company_name' | 'contact_name' | 'status'>[];
  memberMap: Record<string, string[]>;
}

export function SupplierCategoriesClient({ categories: initial, suppliers, memberMap: initialMap }: Props) {
  const [cats, setCats] = useState(initial);
  const [memberMap, setMemberMap] = useState<Record<string, Set<string>>>(
    Object.fromEntries(Object.entries(initialMap).map(([k, v]) => [k, new Set(v)]))
  );
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupplierCategory | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(cat: SupplierCategory) { setEditing(cat); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      await upsertSupplierCategory(formData);
      closeForm();
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this supplier category?')) return;
    startTransition(async () => {
      await deleteSupplierCategory(id);
      setCats(c => c.filter(x => x.id !== id));
    });
  }

  function toggleMember(categoryId: string, supplierId: string) {
    const isIn = memberMap[categoryId]?.has(supplierId) ?? false;
    setMemberMap(prev => {
      const next = { ...prev };
      const set = new Set(next[categoryId] ?? []);
      if (isIn) set.delete(supplierId); else set.add(supplierId);
      next[categoryId] = set;
      return next;
    });
    startTransition(async () => {
      await toggleSupplierCategoryMember(supplierId, categoryId, !isIn);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Categories ({cats.length})</p>
          <button onClick={openNew} className="text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity">+ New Category</button>
        </div>

        {showForm && (
          <form action={handleSave} className="bg-[#F2F2F7] rounded-xl p-4 mb-4 space-y-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Name *</label>
              <input name="name" required defaultValue={editing?.name ?? ''} placeholder="e.g. IT & Technology" className={INP} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Description</label>
              <input name="description" defaultValue={editing?.description ?? ''} placeholder="What specializations does this category cover?" className={INP} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={isPending}
                className="px-4 py-2 rounded-[8px] text-white text-[13px] font-semibold disabled:opacity-40"
                style={{ backgroundColor: '#007AFF' }}>
                {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
              </button>
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-[#3C3C43] bg-white border border-[#E5E5EA]">
                Cancel
              </button>
            </div>
          </form>
        )}

        {cats.length === 0 ? (
          <p className="text-[14px] text-[#8E8E93] text-center py-4">No categories yet.</p>
        ) : (
          <div className="divide-y divide-[#F2F2F7]">
            {cats.map(cat => {
              const members = memberMap[cat.id] ?? new Set();
              const isOpen = expanded === cat.id;
              return (
                <div key={cat.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-black">{cat.name}</p>
                      {cat.description && <p className="text-[12px] text-[#8E8E93] truncate">{cat.description}</p>}
                      <p className="text-[11px] text-[#8E8E93] mt-0.5">{members.size} supplier{members.size !== 1 ? 's' : ''} assigned</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setExpanded(isOpen ? null : cat.id)}
                        className="text-[12px] text-[#007AFF] hover:opacity-70">
                        {isOpen ? 'Hide' : 'Suppliers'}
                      </button>
                      <button onClick={() => openEdit(cat)} className="text-[12px] text-[#007AFF] hover:opacity-70">Edit</button>
                      <button onClick={() => handleDelete(cat.id)} disabled={isPending} className="text-[12px] text-[#FF3B30] hover:opacity-70 disabled:opacity-30">Delete</button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 bg-[#F2F2F7] rounded-xl p-3">
                      <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">Assign Suppliers</p>
                      {suppliers.length === 0 ? (
                        <p className="text-[12px] text-[#8E8E93]">No active suppliers.</p>
                      ) : (
                        <div className="space-y-2">
                          {suppliers.map(s => (
                            <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-white rounded-lg px-2 py-1.5 transition-colors">
                              <input
                                type="checkbox"
                                checked={members.has(s.id)}
                                onChange={() => toggleMember(cat.id, s.id)}
                                disabled={isPending}
                                className="w-4 h-4 rounded border-[#E5E5EA] accent-[#007AFF]"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-black leading-tight">{s.company_name}</p>
                                {s.contact_name && <p className="text-[11px] text-[#8E8E93] leading-tight">{s.contact_name}</p>}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
