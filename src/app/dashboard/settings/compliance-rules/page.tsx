import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listComplianceRules, deleteComplianceRule } from '@/lib/actions/compliance';
import { ComplianceRulesClient } from './compliance-rules-client';

export default async function ComplianceRulesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminDb = createAdminClient();
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') redirect('/dashboard');

  const rules = await listComplianceRules();

  return <ComplianceRulesClient rules={rules} onDelete={deleteComplianceRule} />;
}
