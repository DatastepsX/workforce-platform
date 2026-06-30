'use client';

import { useState, useTransition } from 'react';
import { upsertOrgUnit, deleteOrgUnit } from '@/lib/actions/job-descriptions';
import type { OrgUnit } from '@/types/database';

const INP = 'w-full px-3 py-2 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]';

interface Props { tenantId: string; orgUnits: OrgUnit[] }

export function OrgUnitsSection({ tenantId, orgUnits: initial }: Props) {
  const [units, setUnits] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OrgUnit | null>(null);
  const [isPending, startTransition] = useTransition();

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(u: OrgUnit) { setEditing(u); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      await upsertOrgUnit(formData);
      // optimistic refresh — page revalidates; just close the form
      closeForm();
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this Org Unit? Job descriptions linked to it will become unassigned.')) return;
    startTransition(async () => {
      await deleteOrgUnit(id, tenantId);
      setUnits(u => u.filter(x => x.id !== id));
    });
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Org Units ({units.length})</p>
        <button onClick={openNew} className="text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity">+ Add</button>
      </div>

      {showForm && (
        <form action={handleSave} className="bg-[#F2F2F7] rounded-xl p-4 mb-4 space-y-3">
          <input type="hidden" name="tenant_id" value={tenantId} />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Name *</label>
              <input name="name" required defaultValue={editing?.name ?? ''} placeholder="e.g. Engineering" className={INP} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Position</label>
              <input name="position" type="number" defaultValue={editing?.position ?? 0} className={INP} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Description</label>
            <input name="description" defaultValue={editing?.description ?? ''} placeholder="Optional description" className={INP} />
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

      {units.length === 0 ? (
        <p className="text-[14px] text-[#8E8E93] text-center py-4">No org units yet.</p>
      ) : (
        <div className="divide-y divide-[#F2F2F7]">
          {[...units].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)).map(u => (
            <div key={u.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-black">{u.name}</p>
                {u.description && <p className="text-[12px] text-[#8E8E93] truncate">{u.description}</p>}
              </div>
              <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                {!u.active && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#8E8E93]/10 text-[#8E8E93]">Inactive</span>
                )}
                <button onClick={() => openEdit(u)} className="text-[12px] text-[#007AFF] hover:opacity-70 transition-opacity">Edit</button>
                <button onClick={() => handleDelete(u.id)} disabled={isPending} className="text-[12px] text-[#FF3B30] hover:opacity-70 transition-opacity disabled:opacity-30">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
