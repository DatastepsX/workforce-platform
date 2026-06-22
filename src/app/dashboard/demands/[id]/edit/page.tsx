import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { updateDemand } from '@/lib/actions/demands';
import { DemandForm } from '../../demand-form';
import type { Demand } from '@/types/database';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDemandPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: demandData }, { data: profileData }] = await Promise.all([
    supabase.from('demands').select('*').eq('id', id).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ]);

  if (!demandData) notFound();
  const demand = demandData as Demand;
  const role = profileData?.role ?? 'candidate';

  const canEdit = demand.created_by === user.id || ['admin', 'recruiter'].includes(role);
  if (!canEdit) redirect(`/dashboard/demands/${id}`);

  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Edit Demand</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">{demand.title}</p>
      </div>
      <DemandForm
        action={updateDemand}
        defaultValues={{
          id: demand.id,
          title: demand.title,
          contract_type: demand.contract_type,
          priority: demand.priority,
          description: demand.description,
          location: demand.location,
          remote_allowed: demand.remote_allowed,
          start_date: demand.start_date,
          end_date: demand.end_date,
          budget_min: demand.budget_min,
          budget_max: demand.budget_max,
          skills: demand.skills,
          experience_years: demand.experience_years,
          channels: demand.channels,
        }}
        submitLabel="Save Changes"
        cancelHref={`/dashboard/demands/${id}`}
      />
    </div>
  );
}
