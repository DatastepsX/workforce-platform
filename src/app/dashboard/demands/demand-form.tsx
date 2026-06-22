'use client';

import { useState } from 'react';

const inputCls = 'w-full bg-[#F2F2F7] rounded-xl px-4 py-3.5 text-[15px] text-black placeholder:text-[#8E8E93] outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors';

const BUDGET_META: Record<string, { section: string; minLabel: string; maxLabel: string; minPlaceholder: string; maxPlaceholder: string }> = {
  permanent:  { section: 'Annual Salary (€)', minLabel: 'Min Salary',    maxLabel: 'Max Salary',    minPlaceholder: '55000',  maxPlaceholder: '90000' },
  freelance:  { section: 'Hourly Rate (€)',   minLabel: 'Min Rate / hr', maxLabel: 'Max Rate / hr', minPlaceholder: '80',     maxPlaceholder: '150' },
  contractor: { section: 'Day Rate (€)',       minLabel: 'Min Day Rate',  maxLabel: 'Max Day Rate',  minPlaceholder: '600',    maxPlaceholder: '1200' },
  internship: { section: 'Monthly Pay (€)',    minLabel: 'Min / month',   maxLabel: 'Max / month',   minPlaceholder: '800',    maxPlaceholder: '1500' },
};

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
  };
  submitLabel?: string;
  cancelHref: string;
  /** When provided, shows a required client picker (for roles without a profile tenant). */
  tenants?: { id: string; name: string }[];
}

export function DemandForm({ action, defaultValues, submitLabel = 'Create Demand', cancelHref, tenants }: Props) {
  const dv = defaultValues ?? {};
  const [contractType, setContractType] = useState(dv.contract_type ?? 'permanent');

  const isPermanent = contractType === 'permanent';
  const bm = BUDGET_META[contractType] ?? BUDGET_META.contractor;

  return (
    <form action={action} className="space-y-5">
      {dv.id && <input type="hidden" name="id" value={dv.id} />}

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

      {/* Position */}
      <Section label="Position">
        <Field label="Job Title" required>
          <input name="title" required defaultValue={dv.title ?? ''} placeholder="e.g. Senior Frontend Developer" className={inputCls} />
        </Field>
        <Field label="Contract Type">
          <select name="contract_type" value={contractType} onChange={e => setContractType(e.target.value)} className={inputCls}>
            <option value="permanent">Permanent</option>
            <option value="freelance">Freelance</option>
            <option value="contractor">Contractor</option>
            <option value="internship">Internship</option>
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
          <textarea name="description" rows={4} defaultValue={dv.description ?? ''} placeholder="Describe the role, responsibilities, and requirements…" className={inputCls + ' resize-none'} />
        </Field>
      </Section>

      {/* Location */}
      <Section label="Location">
        <Field label="City / Country">
          <input name="location" defaultValue={dv.location ?? ''} placeholder="e.g. Berlin, Germany" className={inputCls} />
        </Field>
        <Field label="Remote">
          <select name="remote_allowed" defaultValue={String(dv.remote_allowed ?? false)} className={inputCls}>
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

      {/* Budget — label and placeholders adapt to contract type */}
      <Section label={bm.section}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={bm.minLabel}>
            <input name="budget_min" type="number" min="0" defaultValue={dv.budget_min ?? ''} placeholder={bm.minPlaceholder} className={inputCls} />
          </Field>
          <Field label={bm.maxLabel}>
            <input name="budget_max" type="number" min="0" defaultValue={dv.budget_max ?? ''} placeholder={bm.maxPlaceholder} className={inputCls} />
          </Field>
        </div>
      </Section>

      {/* Requirements */}
      <Section label="Requirements">
        <Field label="Skills (comma-separated)">
          <input name="skills" defaultValue={dv.skills?.join(', ') ?? ''} placeholder="e.g. React, TypeScript, Node.js" className={inputCls} />
        </Field>
        <Field label="Years of Experience">
          <input name="experience_years" type="number" min="0" max="30" defaultValue={dv.experience_years ?? ''} placeholder="3" className={inputCls} />
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
