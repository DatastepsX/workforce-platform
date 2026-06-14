import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createSupplier } from '@/lib/actions/suppliers';

export default async function NewSupplierPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter'].includes(profile?.role ?? '')) redirect('/dashboard');

  return (
    <div className="px-8 py-10 max-w-xl">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Add Supplier</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">Register a new staffing supplier.</p>
      </div>

      <form action={createSupplier} className="space-y-5">
        <Section label="Company">
          <Field label="Company Name" required>
            <input name="company_name" required placeholder="e.g. TechStaff GmbH" className={inputCls} />
          </Field>
          <Field label="Contact Person">
            <input name="contact_name" placeholder="e.g. Maria Müller" className={inputCls} />
          </Field>
        </Section>

        <Section label="Contact">
          <Field label="Email" required>
            <input name="email" type="email" required placeholder="contact@supplier.com" className={inputCls} />
          </Field>
          <Field label="Phone">
            <input name="phone" type="tel" placeholder="+49 30 123456" className={inputCls} />
          </Field>
        </Section>

        <Section label="Specializations">
          <Field label="Areas (comma-separated)">
            <input name="specializations" placeholder="e.g. IT, Engineering, Finance" className={inputCls} />
          </Field>
        </Section>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-3 rounded-[12px] text-white text-[15px] font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.28)' }}
          >
            Add Supplier
          </button>
          <a
            href="/dashboard/suppliers"
            className="px-6 py-3 rounded-[12px] text-[15px] font-medium text-[#3C3C43] bg-white hover:bg-[#F2F2F7] transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          >
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
