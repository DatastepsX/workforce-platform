'use client';

import { useState, useMemo } from 'react';

const inputCls = 'w-full bg-[#F2F2F7] rounded-xl px-4 py-3.5 text-[15px] text-black placeholder:text-[#8E8E93] outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors';

const BUDGET_META: Record<string, { section: string; minLabel: string; maxLabel: string; minPlaceholder: string; maxPlaceholder: string }> = {
  permanent:  { section: 'Annual Salary (€)', minLabel: 'Min Salary',    maxLabel: 'Max Salary',    minPlaceholder: '55000',  maxPlaceholder: '90000' },
  freelance:  { section: 'Hourly Rate (€)',   minLabel: 'Min Rate / hr', maxLabel: 'Max Rate / hr', minPlaceholder: '80',     maxPlaceholder: '150' },
  contractor: { section: 'Day Rate (€)',       minLabel: 'Min Day Rate',  maxLabel: 'Max Day Rate',  minPlaceholder: '600',    maxPlaceholder: '1200' },
  internship: { section: 'Monthly Pay (€)',    minLabel: 'Min / month',   maxLabel: 'Max / month',   minPlaceholder: '800',    maxPlaceholder: '1500' },
};

interface JobDescriptionOption {
  id: string;
  title: string;
  org_unit_id: string | null;
  contract_type: string | null;
  description: string | null;
  skills: string[];
  budget_min: number | null;
  budget_max: number | null;
  experience_years: number | null;
  location: string | null;
  remote_allowed: boolean;
}

interface OrgUnitOption { id: string; name: string }

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (formData: FormData) => any;
  defaultValues?: {
    id?: string;
    title?: string;
    contract_type?: string | null;
    priority?: string | null;
    description?: string | null;
    location?: string | null;
    remote_allowed?: boolean | null;
    start_date?: string | null;
    end_date?: string | null;
    budget_min?: number | null;
    budget_max?: number | null;
    skills?: string[];
    experience_years?: number | null;
    channels?: string[];
    billing_period_type?: string | null;
    rate_type?: string | null;
  };
  submitLabel?: string;
  cancelHref: string;
  /** When provided, shows a required client picker (for roles without a profile tenant). */
  tenants?: { id: string; name: string }[];
  /** Job descriptions available for pre-fill. */
  jobDescriptions?: JobDescriptionOption[];
  /** Org units for JD filter. */
  orgUnits?: OrgUnitOption[];
  /** The user's org_unit_id — pre-selects the matching filter. */
  userOrgUnitId?: string | null;
}

export function DemandForm({ action, defaultValues, submitLabel = 'Create Demand', cancelHref, tenants, jobDescriptions = [], orgUnits = [], userOrgUnitId }: Props) {
  const dv = defaultValues ?? {};
  const [contractType, setContractType] = useState(dv.contract_type ?? 'permanent');
  const [title, setTitle] = useState(dv.title ?? '');
  const [description, setDescription] = useState(dv.description ?? '');
  const [location, setLocation] = useState(dv.location ?? '');
  const [remoteAllowed, setRemoteAllowed] = useState(String(dv.remote_allowed ?? false));
  const [budgetMin, setBudgetMin] = useState(dv.budget_min != null ? String(dv.budget_min) : '');
  const [budgetMax, setBudgetMax] = useState(dv.budget_max != null ? String(dv.budget_max) : '');
  const [skills, setSkills] = useState(dv.skills?.join(', ') ?? '');
  const [experienceYears, setExperienceYears] = useState(dv.experience_years != null ? String(dv.experience_years) : '');

  // JD picker state
  const [jdSearchOpen, setJdSearchOpen] = useState(false);
  const [jdQuery, setJdQuery] = useState('');
  const [jdOrgFilter, setJdOrgFilter] = useState(userOrgUnitId ?? 'all');
  const [selectedJdTitle, setSelectedJdTitle] = useState<string | null>(null);
  const [selectedJdId, setSelectedJdId] = useState<string | null>(null);

  const filteredJds = useMemo(() => {
    const q = jdQuery.toLowerCase();
    return jobDescriptions.filter(jd => {
      if (jdOrgFilter !== 'all' && jd.org_unit_id !== jdOrgFilter) return false;
      if (!q) return true;
      return jd.title.toLowerCase().includes(q) || jd.skills.some(s => s.toLowerCase().includes(q));
    });
  }, [jobDescriptions, jdQuery, jdOrgFilter]);

  function applyJd(jd: JobDescriptionOption) {
    setTitle(jd.title);
    if (jd.contract_type) setContractType(jd.contract_type);
    setDescription(jd.description ?? '');
    setLocation(jd.location ?? '');
    setRemoteAllowed(String(jd.remote_allowed));
    if (jd.budget_min != null) setBudgetMin(String(jd.budget_min));
    if (jd.budget_max != null) setBudgetMax(String(jd.budget_max));
    if (jd.skills.length > 0) setSkills(jd.skills.join(', '));
    if (jd.experience_years != null) setExperienceYears(String(jd.experience_years));
    setSelectedJdTitle(jd.title);
    setSelectedJdId(jd.id);
    setJdSearchOpen(false);
    setJdQuery('');
  }

  const isPermanent = contractType === 'permanent';
  const bm = BUDGET_META[contractType] ?? BUDGET_META.contractor;

  return (
    <form action={action} className="space-y-5">
      {dv.id && <input type="hidden" name="id" value={dv.id} />}
      {selectedJdId && <input type="hidden" name="job_description_id" value={selectedJdId} />}

      {/* Client picker — shown when the creator has no profile tenant */}
      {tenants && tenants.length > 0 && (
        <Section label="Client">
          <Field label="Client" required>
            <select name="tenant_id" required className={inputCls}>
              <option value="">— Select a client —</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        </Section>
      )}

      {/* JD picker — only when jobDescriptions are available */}
      {jobDescriptions.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Job Description Template</p>
              {selectedJdTitle ? (
                <p className="text-[13px] text-black mt-0.5">
                  <span className="text-[#34C759] font-medium">✓ </span>
                  Pre-filled from <span className="font-semibold">{selectedJdTitle}</span>
                  <button type="button" onClick={() => { setSelectedJdTitle(null); setSelectedJdId(null); }} className="ml-2 text-[#8E8E93] hover:text-[#FF3B30] text-[11px]">Clear</button>
                </p>
              ) : (
                <p className="text-[13px] text-[#8E8E93] mt-0.5">Select a template to pre-fill the form</p>
              )}
            </div>
            <button type="button" onClick={() => setJdSearchOpen(o => !o)}
              className="text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity">
              {jdSearchOpen ? 'Close' : 'Browse Templates'}
            </button>
          </div>

          {jdSearchOpen && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input type="text" value={jdQuery} onChange={e => setJdQuery(e.target.value)}
                    placeholder="Search job descriptions…" autoFocus
                    className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-[13px] focus:outline-none focus:border-[#007AFF] transition-colors" />
                </div>
                {orgUnits.length > 0 && (
                  <select value={jdOrgFilter} onChange={e => setJdOrgFilter(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[#E5E5EA] bg-[#F2F2F7] text-[13px] focus:outline-none focus:border-[#007AFF] min-w-[130px]">
                    <option value="all">All Org Units</option>
                    {orgUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[#F2F2F7] border border-[#E5E5EA] rounded-xl bg-white">
                {filteredJds.length === 0 ? (
                  <p className="p-4 text-[13px] text-[#8E8E93] text-center">No templates found</p>
                ) : filteredJds.map(jd => {
                  const orgUnit = orgUnits.find(u => u.id === jd.org_unit_id);
                  return (
                    <button key={jd.id} type="button" onClick={() => applyJd(jd)}
                      className="w-full text-left px-4 py-3 hover:bg-[#F2F2F7] transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-semibold text-black">{jd.title}</p>
                        {orgUnit && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#AF52DE]/10 text-[#AF52DE]">{orgUnit.name}</span>}
                        {jd.contract_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2F2F7] text-[#8E8E93]">{jd.contract_type}</span>}
                      </div>
                      {jd.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {jd.skills.slice(0, 4).map(s => <span key={s} className="text-[10px] bg-[#007AFF]/10 text-[#007AFF] px-1.5 py-0.5 rounded-full">{s}</span>)}
                          {jd.skills.length > 4 && <span className="text-[10px] text-[#8E8E93]">+{jd.skills.length - 4}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Position */}
      <Section label="Position">
        <Field label="Job Title" required>
          <input name="title" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Developer" className={inputCls} />
        </Field>
        <Field label="Contract Type">
          <select name="contract_type" value={contractType} onChange={e => setContractType(e.target.value)} className={inputCls}>
            <option value="perm">Permanent (Perm)</option>
            <option value="temp">Temporary Staffing (Temp)</option>
            <option value="contracting">Contracting</option>
            <option value="sow">Statement of Work (SOW)</option>
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue={dv.priority ?? 'medium'} className={inputCls}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
      </Section>

      {/* Description */}
      <Section label="Description">
        <Field label="Job Description">
          <textarea name="description" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the role, responsibilities, and requirements…" className={inputCls + ' resize-none'} />
        </Field>
      </Section>

      {/* Location */}
      <Section label="Location">
        <Field label="City / Country">
          <input name="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Berlin, Germany" className={inputCls} />
        </Field>
        <Field label="Remote">
          <select name="remote_allowed" value={remoteAllowed} onChange={e => setRemoteAllowed(e.target.value)} className={inputCls}>
            <option value="false">On-site only</option>
            <option value="true">Remote allowed</option>
          </select>
        </Field>
      </Section>

      {/* Timeline — end date hidden for permanent */}
      <Section label="Timeline">
        {isPermanent ? (
          <Field label="Start Date">
            <input name="start_date" type="date" defaultValue={dv.start_date ?? ''} className={inputCls} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <input name="start_date" type="date" defaultValue={dv.start_date ?? ''} className={inputCls} />
            </Field>
            <Field label="End Date">
              <input name="end_date" type="date" defaultValue={dv.end_date ?? ''} className={inputCls} />
            </Field>
          </div>
        )}
      </Section>

      {/* Billing — hidden for permanent roles */}
      {!isPermanent && (
        <Section label="Billing">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing Period Type">
              <select name="billing_period_type" defaultValue={dv.billing_period_type ?? ''} className={inputCls}>
                <option value="">— Not specified —</option>
                <option value="weekly">Weekly</option>
                <option value="bi_weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="milestone">Milestone-based</option>
                <option value="fixed">Fixed Fee</option>
              </select>
            </Field>
            <Field label="Rate Type">
              <select name="rate_type" defaultValue={dv.rate_type ?? 'daily'} className={inputCls}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
              </select>
            </Field>
          </div>
        </Section>
      )}

      {/* Budget — label and placeholders adapt to contract type */}
      <Section label={bm.section}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={bm.minLabel}>
            <input name="budget_min" type="number" min="0" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder={bm.minPlaceholder} className={inputCls} />
          </Field>
          <Field label={bm.maxLabel}>
            <input name="budget_max" type="number" min="0" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder={bm.maxPlaceholder} className={inputCls} />
          </Field>
        </div>
      </Section>

      {/* Requirements */}
      <Section label="Requirements">
        <Field label="Skills (comma-separated)">
          <input name="skills" value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. React, TypeScript, Node.js" className={inputCls} />
        </Field>
        <Field label="Years of Experience">
          <input name="experience_years" type="number" min="0" max="30" value={experienceYears} onChange={e => setExperienceYears(e.target.value)} placeholder="3" className={inputCls} />
        </Field>
      </Section>

      {/* Distribution */}
      <Section label="Distribution Channels">
        <p className="text-[13px] text-[#8E8E93] -mt-1">Choose how this demand reaches candidates.</p>
        <div className="space-y-1">
          <ChannelOption value="suppliers" label="Supplier Network" description="Send to your approved suppliers — they submit candidates on your behalf" defaultChecked={dv.channels ? dv.channels.includes('suppliers') : true} />
          <ChannelOption value="career_portal" label="Career Portal" description="Post publicly on /careers — candidates apply directly without an agency" defaultChecked={dv.channels ? dv.channels.includes('career_portal') : false} />
        </div>
      </Section>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="px-6 py-3 rounded-[12px] text-white text-[15px] font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.28)' }}
        >
          {submitLabel}
        </button>
        <a href={cancelHref} className="px-6 py-3 rounded-[12px] text-[15px] font-medium text-[#3C3C43] bg-white hover:bg-[#F2F2F7] transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          Cancel
        </a>
      </div>
    </form>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
      <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-[#3C3C43]">
        {label}{required && <span className="text-[#FF3B30] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ChannelOption({ value, label, description, defaultChecked }: {
  value: string; label: string; description: string; defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#E5E5EA] hover:border-[#007AFF]/40 hover:bg-[#007AFF]/4 transition-colors cursor-pointer">
      <input
        type="checkbox"
        name="channels"
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 w-4 h-4 flex-shrink-0"
        style={{ accentColor: '#007AFF' }}
      />
      <div>
        <p className="text-[14px] font-semibold text-black leading-tight">{label}</p>
        <p className="text-[12px] text-[#8E8E93] mt-0.5 leading-snug">{description}</p>
      </div>
    </label>
  );
}
