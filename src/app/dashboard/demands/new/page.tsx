import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createDemand } from '@/lib/actions/demands';

export default async function NewDemandPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'candidate';
  if (!['admin', 'hiring_manager', 'recruiter'].includes(role)) redirect('/dashboard');

  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">New Demand</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">Fill in the position details below.</p>
      </div>

      <form action={createDemand} className="space-y-5">
        {/* Title */}
        <Section label="Position">
          <Field label="Job Title" required>
            <input name="title" required placeholder="e.g. Senior Frontend Developer"
              className={inputCls} />
          </Field>
          <Field label="Contract Type">
            <select name="contract_type" className={inputCls}>
              <option value="permanent">Permanent</option>
              <option value="freelance">Freelance</option>
              <option value="contractor">Contractor</option>
              <option value="internship">Internship</option>
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority" className={inputCls}>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
        </Section>

        {/* Description */}
        <Section label="Description">
          <Field label="Job Description">
            <textarea name="description" rows={4} placeholder="Describe the role, responsibilities, and requirements…"
              className={inputCls + ' resize-none'} />
          </Field>
        </Section>

        {/* Location */}
        <Section label="Location">
          <Field label="City / Country">
            <input name="location" placeholder="e.g. Berlin, Germany" className={inputCls} />
          </Field>
          <Field label="Remote">
            <select name="remote_allowed" className={inputCls}>
              <option value="false">On-site only</option>
              <option value="true">Remote allowed</option>
            </select>
          </Field>
        </Section>

        {/* Timeline */}
        <Section label="Timeline">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <input name="start_date" type="date" className={inputCls} />
            </Field>
            <Field label="End Date">
              <input name="end_date" type="date" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Budget */}
        <Section label="Budget (€)">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum">
              <input name="budget_min" type="number" min="0" placeholder="0" className={inputCls} />
            </Field>
            <Field label="Maximum">
              <input name="budget_max" type="number" min="0" placeholder="0" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Skills */}
        <Section label="Requirements">
          <Field label="Skills (comma-separated)">
            <input name="skills" placeholder="e.g. React, TypeScript, Node.js" className={inputCls} />
          </Field>
          <Field label="Years of Experience">
            <input name="experience_years" type="number" min="0" max="30" placeholder="3" className={inputCls} />
          </Field>
        </Section>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-3 rounded-[12px] text-white text-[15px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.28)' }}
          >
            Create Demand
          </button>
          <a href="/dashboard/demands"
            className="px-6 py-3 rounded-[12px] text-[15px] font-medium text-[#3C3C43] bg-white hover:bg-[#F2F2F7] transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full bg-[#F2F2F7] rounded-xl px-4 py-3.5 text-[15px] text-black placeholder:text-[#8E8E93] outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors';

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
