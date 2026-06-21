import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { CandidateProfile, Demand, Profile, SupplierCandidate } from '@/types/database';
import { CandidatesListClient } from './candidates-list-client';
import type { CandidateRow, SupplierCandidateRow } from './candidates-list-client';

export default async function CandidatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter'].includes(me?.role ?? '')) redirect('/dashboard');

  // Admin client to read supplier_candidates across all suppliers
  const admin = createAdminClient();

  const [{ data: cpData }, { data: demandsData }, { data: scData }, { data: suppliersData }] = await Promise.all([
    supabase.from('candidate_profiles').select('*').order('updated_at', { ascending: false }),
    supabase.from('demands').select('*').in('status', ['sourcing','screening','interview']).order('updated_at', { ascending: false }),
    admin.from('supplier_candidates').select('*').order('created_at', { ascending: false }),
    admin.from('suppliers').select('id, company_name'),
  ]);

  const openDemands = (demandsData ?? []) as Demand[];
  const supplierNameMap = Object.fromEntries(
    ((suppliersData ?? []) as { id: string; company_name: string }[]).map(s => [s.id, s.company_name])
  );

  // Build registered candidates (candidate_profiles + auth profiles join)
  const ids = (cpData ?? []).map(cp => cp.id);
  const profileMap: Record<string, Pick<Profile, 'id' | 'full_name' | 'email'>> = {};
  if (ids.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);
    ((profilesData ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[]).forEach(p => {
      profileMap[p.id] = p;
    });
  }

  const registeredCandidates: CandidateRow[] = ((cpData ?? []) as CandidateProfile[])
    .map(cp => ({ ...cp, profile: profileMap[cp.id] }))
    .filter(c => c.profile);

  // Build supplier candidates
  const supplierCandidates: SupplierCandidateRow[] = ((scData ?? []) as SupplierCandidate[]).map(sc => ({
    ...sc,
    supplier_name: supplierNameMap[sc.supplier_id] ?? null,
  }));

  if (!registeredCandidates.length && !supplierCandidates.length) {
    return (
      <div className="px-8 py-10">
        <h1 className="text-[34px] font-bold tracking-tight text-black mb-2">Candidates</h1>
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)] mt-6">
          <p className="text-[17px] font-semibold text-black mb-1">No candidates yet</p>
          <p className="text-[15px] text-[#8E8E93]">Candidates appear here once they apply or suppliers upload them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-10">
      <div className="mb-6">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Candidates</h1>
      </div>
      <CandidatesListClient
        candidates={registeredCandidates}
        supplierCandidates={supplierCandidates}
        openDemands={openDemands}
      />
    </div>
  );
}
