import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { updateSupplierCandidate } from '@/lib/actions/submissions';
import { CandidateForm } from '../candidate-form';
import type { SupplierCandidate } from '@/types/database';

export default async function EditSupplierCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: supplierData } = await supabase
    .from('suppliers')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (!supplierData) redirect('/supplier');

  const { data } = await supabase
    .from('supplier_candidates')
    .select('*')
    .eq('id', id)
    .eq('supplier_id', supplierData.id)
    .single();

  if (!data) redirect('/supplier/candidates');

  const candidate = data as SupplierCandidate;

  return (
    <div className="px-5 py-8 max-w-lg mx-auto">
      <Link
        href="/supplier/candidates"
        className="inline-flex items-center gap-1 text-[14px] text-[#007AFF] mb-6 hover:opacity-70 transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Candidate Pool
      </Link>

      <h1 className="text-[28px] font-bold tracking-tight text-black mb-6">Edit Candidate</h1>

      <CandidateForm
        action={updateSupplierCandidate}
        submitLabel="Save Changes"
        candidate={candidate}
      />
    </div>
  );
}
