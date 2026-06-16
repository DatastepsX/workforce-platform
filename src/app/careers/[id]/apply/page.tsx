import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApplyForm } from './apply-form';
import type { Demand } from '@/types/database';

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('demands')
    .select('id, title, location, contract_type')
    .eq('id', id)
    .eq('status', 'open')
    .single();

  if (!data) notFound();
  const demand = data as Pick<Demand, 'id' | 'title' | 'location' | 'contract_type'>;

  return (
    <div className="max-w-lg mx-auto">
      {/* Back */}
      <Link
        href={`/careers/${id}`}
        className="inline-flex items-center gap-1 text-[14px] text-[#007AFF] mb-6 hover:opacity-70 transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        {demand.title}
      </Link>

      <div className="bg-white rounded-2xl p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <h1 className="text-[22px] font-bold text-black mb-0.5">Apply for this position</h1>
        <p className="text-[14px] text-[#8E8E93] mb-6">
          {demand.title}
          {demand.location ? ` · ${demand.location}` : ''}
        </p>

        <ApplyForm demandId={demand.id} demandTitle={demand.title} />
      </div>
    </div>
  );
}
