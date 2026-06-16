import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { deleteSupplierCandidate } from '@/lib/actions/submissions';
import { DeleteButton } from '@/components/DeleteButton';
import type { SupplierCandidate } from '@/types/database';

export default async function SupplierCandidatesPage() {
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
    .eq('supplier_id', supplierData.id)
    .order('created_at', { ascending: false });

  const candidates = (data ?? []) as SupplierCandidate[];

  return (
    <div className="px-5 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-black leading-tight">
            Candidate Pool
          </h1>
          <p className="text-[15px] text-[#8E8E93] mt-0.5">
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/supplier/candidates/new"
          className="px-4 py-2.5 rounded-[10px] text-white text-[14px] font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#007AFF' }}
        >
          + Add Candidate
        </Link>
      </div>

      {candidates.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="w-14 h-14 bg-[#007AFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold text-black mb-1">No candidates yet</p>
          <p className="text-[15px] text-[#8E8E93] mb-5">
            Build your candidate pool to quickly submit to open demands.
          </p>
          <Link
            href="/supplier/candidates/new"
            className="inline-block px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold"
            style={{ backgroundColor: '#007AFF' }}
          >
            Add First Candidate
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map(c => (
            <div key={c.id} className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-[17px] font-semibold text-black">{c.name}</h2>
                  {c.headline && (
                    <p className="text-[14px] text-[#8E8E93] mt-0.5">{c.headline}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-[#8E8E93] mt-1">
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                  </div>
                  {c.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {c.skills.map(s => (
                        <span key={s} className="text-[11px] bg-[#007AFF]/10 text-[#007AFF] px-2.5 py-0.5 rounded-full font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {c.cv_path && (
                  <span className="flex-shrink-0 text-[12px] text-[#34C759] font-semibold bg-[#34C759]/10 px-2.5 py-1 rounded-full">
                    CV
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#F2F2F7]">
                <Link
                  href={`/supplier/candidates/${c.id}`}
                  className="text-[14px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
                >
                  Edit
                </Link>
                <DeleteButton
                  action={deleteSupplierCandidate}
                  id={c.id}
                  confirmMessage={`Delete ${c.name} from your candidate pool?`}
                  label="Delete"
                  className="text-[14px] font-medium text-[#FF3B30] hover:opacity-70 transition-opacity bg-transparent border-0 cursor-pointer p-0"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
