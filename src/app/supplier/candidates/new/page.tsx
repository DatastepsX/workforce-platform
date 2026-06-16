import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupplierCandidate } from '@/lib/actions/submissions';
import { CandidateForm } from '../candidate-form';

export default async function NewSupplierCandidatePage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { return_to } = await searchParams;
  const backHref = return_to ?? '/supplier/candidates';

  return (
    <div className="px-5 py-8 max-w-lg mx-auto">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-[14px] text-[#007AFF] mb-6 hover:opacity-70 transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Back
      </Link>

      <h1 className="text-[28px] font-bold tracking-tight text-black mb-6">Add Candidate</h1>

      <CandidateForm
        action={createSupplierCandidate}
        returnTo={return_to}
        submitLabel="Add to Pool"
      />
    </div>
  );
}
