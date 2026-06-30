import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getComplianceRule, updateComplianceRule } from '@/lib/actions/compliance';
import { ComplianceRuleForm } from '../compliance-rule-form';
import Link from 'next/link';

const SEVERITY_LABELS: Record<string, string> = { info: 'ℹ Info', warning: '⚠ Warning', error: '✗ Hard Stop' };

export default async function EditComplianceRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') redirect('/dashboard');

  const rule = await getComplianceRule(id);
  if (!rule) notFound();

  const save = async (fd: FormData) => {
    'use server';
    await updateComplianceRule(id, fd);
  };

  const severityCls = { info: 'bg-[#E8F4FD] text-[#007AFF]', warning: 'bg-[#FFF4E8] text-[#FF9500]', error: 'bg-[#FFF0F0] text-[#FF3B30]' }[rule.severity] ?? '';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-4">
        <Link href="/dashboard/settings/compliance-rules" className="hover:text-[#007AFF]">Compliance Rules</Link>
        <span>/</span>
        <span className="text-black">{rule.name}</span>
      </div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-black">{rule.name}</h1>
          <p className="text-[13px] text-[#8E8E93] font-mono">{rule.validation_logic}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${severityCls}`}>{SEVERITY_LABELS[rule.severity]}</span>
          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${rule.active ? 'bg-[#E8FAF0] text-[#34C759]' : 'bg-[#F2F2F7] text-[#8E8E93]'}`}>
            {rule.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      <ComplianceRuleForm rule={rule} onSave={save} />
    </div>
  );
}
