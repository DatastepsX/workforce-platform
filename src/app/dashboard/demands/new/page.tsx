import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDemand } from '@/lib/actions/demands';
import { DemandForm } from '../demand-form';

export default async function NewDemandPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'candidate';
  if (!['super_admin', 'admin', 'hiring_manager', 'recruiter'].includes(role)) redirect('/dashboard');

  // Roles without a profile tenant_id need to pick a client explicitly
  const needsTenantPicker = !profile?.tenant_id;
  let tenants: { id: string; name: string }[] = [];
  if (needsTenantPicker) {
    const admin = createAdminClient();
    const { data } = await admin.from('tenants').select('id, name').eq('active', true).order('name');
    tenants = (data ?? []) as { id: string; name: string }[];
  }

  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">New Demand</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">Fill in the position details below.</p>
      </div>
      <DemandForm action={createDemand} cancelHref="/dashboard/demands" tenants={needsTenantPicker ? tenants : undefined} />
    </div>
  );
}
