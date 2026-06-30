import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { CareerLadder, CareerLadderStep } from '@/types/database';
import { deleteCareerLadder } from '@/lib/actions/career-ladders';

export default async function CareerLaddersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  if (!['super_admin', 'admin', 'recruiter'].includes(me?.role ?? '')) redirect('/dashboard');

  const isSuperAdmin = me?.role === 'super_admin';

  // super_admin uses admin client to bypass RLS and see all ladders with tenant names
  let laddersData: (CareerLadder & { career_ladder_steps: CareerLadderStep[]; tenants?: { name: string } | null })[] = [];
  if (isSuperAdmin) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('career_ladders')
      .select('*, career_ladder_steps(*), tenants(name)')
      .order('name');
    laddersData = (data ?? []) as typeof laddersData;
  } else {
    const { data } = await supabase
      .from('career_ladders')
      .select('*, career_ladder_steps(*)')
      .order('name');
    laddersData = (data ?? []) as typeof laddersData;
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteCareerLadder(id);
  }

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Career Ladders</h1>
          <p className="text-[15px] text-[#8E8E93] mt-0.5">
            Career paths per client — basis for the Career Navigator
          </p>
        </div>
        <Link
          href="/dashboard/career-ladders/new"
          className="flex items-center gap-2 h-10 px-4 rounded-2xl text-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#007AFF' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          New Ladder
        </Link>
      </div>

      {laddersData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C7C7CC] p-10 text-center">
          <p className="text-[15px] font-semibold text-black">No career ladders yet</p>
          <p className="text-[13px] text-[#8E8E93] mt-1">
            {isSuperAdmin
              ? 'Generate a test client with AI or create one manually.'
              : 'Career ladders will be created automatically when a test client is generated, or create one manually.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {laddersData.map(ladder => {
            const steps = (ladder.career_ladder_steps ?? []).sort((a, b) => a.position - b.position);
            const tenantName = (ladder as { tenants?: { name: string } | null }).tenants?.name;
            return (
              <div key={ladder.id} className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="text-[16px] font-semibold text-black">{ladder.name}</h2>
                      {tenantName && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#007AFF] bg-[#007AFF]/10">
                          {tenantName}
                        </span>
                      )}
                    </div>
                    {ladder.industry && (
                      <span className="text-[11px] bg-[#F2F2F7] text-[#8E8E93] px-2 py-0.5 rounded-full inline-block">
                        {ladder.industry}
                      </span>
                    )}
                    {ladder.description && (
                      <p className="text-[13px] text-[#8E8E93] mt-1.5">{ladder.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/dashboard/career-ladders/${ladder.id}`}
                      className="px-3 h-8 rounded-xl border border-[#E5E5EA] text-[12px] font-medium text-[#3C3C43] hover:border-[#007AFF] hover:text-[#007AFF] transition-colors flex items-center">
                      Edit
                    </Link>
                    <form action={handleDelete}>
                      <input type="hidden" name="id" value={ladder.id} />
                      <button type="submit"
                        className="px-3 h-8 rounded-xl border border-[#E5E5EA] text-[12px] font-medium text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {steps.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-1.5">
                        <span className="text-[12px] text-[#3C3C43] bg-[#F2F2F7] px-2.5 py-1 rounded-lg">
                          {step.position}. {step.title}
                        </span>
                        {i < steps.length - 1 && (
                          <svg className="w-3 h-3 text-[#C7C7CC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
