import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { EngagementsClient } from './engagements-client';
import type { Engagement } from '@/types/database';

export default async function EngagementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role, tenant_id').eq('id', user.id).single();
  const role = profile?.role ?? '';
  if (!['super_admin', 'admin', 'recruiter', 'hiring_manager'].includes(role)) redirect('/dashboard');

  const admin = createAdminClient();
  const tenantId = profile?.tenant_id ?? null;

  let engagements: Engagement[] = [];

  if (role !== 'super_admin' && tenantId) {
    const { data: tenantDemands } = await admin.from('demands').select('id').eq('tenant_id', tenantId);
    const demandIds = (tenantDemands ?? []).map((d: { id: string }) => d.id);
    if (demandIds.length > 0) {
      const { data } = await admin
        .from('engagements')
        .select('*')
        .in('demand_id', demandIds)
        .order('updated_at', { ascending: false });
      engagements = (data ?? []) as Engagement[];
    }
  } else {
    const { data } = await admin
      .from('engagements')
      .select('*')
      .order('updated_at', { ascending: false });
    engagements = (data ?? []) as Engagement[];
  }

  return (
    <div className="px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Awards</h1>
          <p className="text-[15px] text-[#8E8E93] mt-0.5">All awarded candidates across demands</p>
        </div>
        {engagements.length > 0 && (
          <span className="text-[13px] font-semibold text-[#8E8E93]">
            {engagements.filter(e => e.status === 'active').length} active
          </span>
        )}
      </div>

      {engagements.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" /><rect x="3" y="4" width="18" height="18" rx="2" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold text-black mb-1">No awards yet</p>
          <p className="text-[14px] text-[#8E8E93] mb-5">Award a candidate from a demand submission to create the first award.</p>
          <Link href="/dashboard/demands" className="inline-block px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold" style={{ backgroundColor: '#007AFF' }}>
            Go to Demands →
          </Link>
        </div>
      ) : (
        <EngagementsClient engagements={engagements} />
      )}
    </div>
  );
}
