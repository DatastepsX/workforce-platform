import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createComplianceRule } from '@/lib/actions/compliance';
import { ComplianceRuleForm } from '../compliance-rule-form';
import Link from 'next/link';

export default async function NewComplianceRulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') redirect('/dashboard');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-4">
        <Link href="/dashboard/settings/compliance-rules" className="hover:text-[#007AFF]">Compliance Rules</Link>
        <span>/</span>
        <span className="text-black">New</span>
      </div>
      <h1 className="text-[22px] font-bold text-black mb-6">New Compliance Rule</h1>
      <ComplianceRuleForm onSave={createComplianceRule} />
    </div>
  );
}
