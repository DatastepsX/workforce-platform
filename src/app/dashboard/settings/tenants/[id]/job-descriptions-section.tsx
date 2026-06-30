'use client';

import { useState, useTransition, useMemo } from 'react';
import { upsertJobDescription, deleteJobDescription } from '@/lib/actions/job-descriptions';
import type { JobDescription, OrgUnit, SupplierCategory } from '@/types/database';

const INP = 'w-full px-3 py-2 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]';
const CONTRACT_LABELS: Record<string, string> = { permanent: 'Permanent', freelance: 'Freelance', contractor: 'Contractor', internship: 'Internship' };

interface Props {
  tenantId: string;
  jobDescriptions: (JobDescription & { org_unit_name?: string | null; supplier_category_ids?: string[] })[];
  orgUnits: OrgUnit[];
  supplierCategories: SupplierCategory[];
}

export function JobDescriptionsSection({ tenantId, jobDescriptions: initial, orgUnits, supplierCategories }: Props) {
  const [jds, setJds] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Props['jobDescriptions'][0] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  function openNew() { setEditing(null); setShowForm(true); setSelectedCats([]); }
  function openEdit(jd: Props['jobDescriptions'][0]) { setEditing(jd); setSelectedCats(jd.supplier_category_ids ?? []); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setSelectedCats([]); }

  function toggleCat(id: string) {
    setSelectedCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSave(formData: FormData) {
    formData.set('supplier_category_ids', selectedCats.join(','));
    startTransition(async () => {
      await upsertJobDescription(formData);
      closeForm();
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this job description?')) return;
    startTransition(async () => {
      await deleteJobDescription(id, tenantId);
      setJds(j => j.filter(x => x.id !== id));
    });
  }

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return jds.filter(j => {
      if (orgFilter !== 'all' && j.org_unit_id !== orgFilter) return false;
      if (!term) return true;
      return j.title.toLowerCase().includes(term) ||
        (j.description ?? '').toLowerCase().includes(term) ||
        j.skills.some(s => s.toLowerCase().includes(term));
    });
  }, [jds, q, orgFilter]);

  const orgUnitMap = Object.fromEntries(orgUnits.map(u => [u.id, u.name]));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Job Descriptions ({jds.length})</p>
        <button onClick={openNew} className="text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity">+ Add</button>
      </div>

      {/* Edit/Create form */}
      {showForm && (
        <form action={handleSave} className="bg-[#F2F2F7] rounded-xl p-4 mb-4 space-y-3">
          <input type="hidden" name="tenant_id" value={tenantId} />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Job Title *</label>
              <input name="title" required defaultValue={editing?.title ?? ''} placeholder="e.g. Senior Software Engineer" className={INP} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Org Unit</label>
              <select name="org_unit_id" defaultValue={editing?.org_unit_id ?? ''} className={INP}>
                <option value="">— None —</option>
                {orgUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Description</label>
            <textarea name="description" rows={3} defaultValue={editing?.description ?? ''} placeholder="Role overview and responsibilities…"
              className="w-full px-3 py-2 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF] resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Contract Type</label>
              <select name="contract_type" defaultValue={editing?.contract_type ?? 'permanent'} className={INP}>
                <option value="permanent">Permanent</option>
                <option value="freelance">Freelance</option>
                <option value="contractor">Contractor</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Budget Min (€)</label>
              <input name="budget_min" type="number" min="0" defaultValue={editing?.budget_min ?? ''} placeholder="60000" className={INP} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Budget Max (€)</label>
              <input name="budget_max" type="number" min="0" defaultValue={editing?.budget_max ?? ''} placeholder="90000" className={INP} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Location</label>
              <input name="location" defaultValue={editing?.location ?? ''} placeholder="Berlin, Germany" className={INP} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Experience (yrs)</label>
              <input name="experience_years" type="number" min="0" defaultValue={editing?.experience_years ?? ''} placeholder="3" className={INP} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Remote</label>
              <select name="remote_allowed" defaultValue={String(editing?.remote_allowed ?? false)} className={INP}>
                <option value="false">On-site</option>
                <option value="true">Remote allowed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Skills (comma-separated)</label>
            <input name="skills" defaultValue={editing?.skills?.join(', ') ?? ''} placeholder="React, TypeScript, Node.js" className={INP} />
          </div>

          {/* Supplier Categories */}
          {supplierCategories.length > 0 && (
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-2">Supplier Categories (auto-assign on demand)</label>
              <div className="flex flex-wrap gap-1.5">
                {supplierCategories.map(cat => (
                  <button key={cat.id} type="button" onClick={() => toggleCat(cat.id)}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${selectedCats.includes(cat.id) ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white text-[#3C3C43] border-[#E5E5EA] hover:border-[#007AFF]'}`}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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

      {/* Filter bar */}
      {jds.length > 0 && !showForm && (
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search job descriptions…"
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-[13px] focus:outline-none focus:border-[#007AFF] transition-colors" />
          </div>
          {orgUnits.length > 0 && (
            <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}
              className="h-8 px-3 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-[13px] focus:outline-none focus:border-[#007AFF] min-w-[130px]">
              <option value="all">All Org Units</option>
              {orgUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* List */}
      {jds.length === 0 ? (
        <p className="text-[14px] text-[#8E8E93] text-center py-4">No job descriptions yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-[14px] text-[#8E8E93] text-center py-4">No results for &ldquo;{q}&rdquo;.</p>
      ) : (
        <div className="divide-y divide-[#F2F2F7] max-h-[400px] overflow-y-auto">
          {filtered.map(jd => (
            <div key={jd.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-[14px] font-semibold text-black">{jd.title}</p>
                    {jd.org_unit_id && orgUnitMap[jd.org_unit_id] && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#AF52DE]/10 text-[#AF52DE]">
                        {orgUnitMap[jd.org_unit_id]}
                      </span>
                    )}
                    {jd.contract_type && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F2F2F7] text-[#8E8E93]">
                        {CONTRACT_LABELS[jd.contract_type] ?? jd.contract_type}
                      </span>
                    )}
                  </div>
                  {jd.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {jd.skills.slice(0, 5).map(s => (
                        <span key={s} className="text-[10px] bg-[#007AFF]/10 text-[#007AFF] px-2 py-0.5 rounded-full font-medium">{s}</span>
                      ))}
                      {jd.skills.length > 5 && <span className="text-[10px] bg-[#F2F2F7] text-[#8E8E93] px-2 py-0.5 rounded-full">+{jd.skills.length - 5}</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(jd)} className="text-[12px] text-[#007AFF] hover:opacity-70">Edit</button>
                  <button onClick={() => handleDelete(jd.id)} disabled={isPending} className="text-[12px] text-[#FF3B30] hover:opacity-70 disabled:opacity-30">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
