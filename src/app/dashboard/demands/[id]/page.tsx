import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { updateDemandStatus, deleteDemand } from '@/lib/actions/demands';
import { SendToSuppliersPanel } from './send-to-suppliers';
import { SuppliersTable } from './suppliers-table';
import { SubmissionsTable } from './submissions-table';
import { DeleteButton } from '@/components/DeleteButton';
import type { Demand, DemandStatus, UserRole, Supplier, DemandSupplier } from '@/types/database';

const STATUS_COLORS: Record<DemandStatus, string> = {
  draft: '#8E8E93',
  open: '#34C759',
  in_progress: '#007AFF',
  on_hold: '#FF9500',
  closed: '#636366',
  cancelled: '#FF3B30',
};

const STATUS_LABELS: Record<DemandStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#8E8E93', medium: '#007AFF', high: '#FF9500', urgent: '#FF3B30',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F2F2F7] last:border-0">
      <span className="text-[14px] text-[#8E8E93] font-medium min-w-[140px]">{label}</span>
      <span className="text-[14px] text-black text-right flex-1">{value ?? '—'}</span>
    </div>
  );
}

export default async function DemandDetailPage({ params }: PageProps) {
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
  const role = (profileData?.role ?? 'candidate') as UserRole;
  const canEdit = demand.created_by === user.id || ['recruiter', 'admin'].includes(role);
  const canSendToSuppliers = ['recruiter', 'admin'].includes(role);
  const canViewSubmissions = ['recruiter', 'admin', 'hiring_manager'].includes(role);

  // Fetch creator profile separately (created_by → auth.users, no direct FK to profiles)
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', demand.created_by)
    .single();
  const creator = creatorProfile as { full_name: string | null; email: string | null } | null;

  // Fetch suppliers + existing demand_suppliers for the send panel
  const [{ data: suppliersData }, { data: sentData }] = canSendToSuppliers
    ? await Promise.all([
        supabase.from('suppliers').select('*').order('company_name'),
        supabase.from('demand_suppliers').select('*').eq('demand_id', id),
      ])
    : [{ data: null }, { data: null }];

  const allSuppliers = (suppliersData ?? []) as Supplier[];
  const sentEntries = ((sentData ?? []) as DemandSupplier[]).map(entry => ({
    ...entry,
    supplier: allSuppliers.find(s => s.id === entry.supplier_id)!,
  })).filter(e => e.supplier);

  const NEXT_STATUSES: Partial<Record<DemandStatus, DemandStatus[]>> = {
    draft: ['open', 'cancelled'],
    open: ['in_progress', 'on_hold', 'cancelled'],
    in_progress: ['on_hold', 'closed', 'cancelled'],
    on_hold: ['open', 'in_progress', 'cancelled'],
  };
  const nextStatuses = canEdit ? (NEXT_STATUSES[demand.status] ?? []) : [];

  return (
    <div className="px-8 py-10 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/demands" className="hover:text-[#007AFF] transition-colors">Demands</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-black font-medium">{demand.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[demand.status] + '18', color: STATUS_COLORS[demand.status] }}
            >
              {STATUS_LABELS[demand.status]}
            </span>
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: PRIORITY_COLORS[demand.priority] + '18', color: PRIORITY_COLORS[demand.priority] }}
            >
              {demand.priority.charAt(0).toUpperCase() + demand.priority.slice(1)} priority
            </span>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-black leading-tight">{demand.title}</h1>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {canEdit && nextStatuses.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-end">
              {nextStatuses.map(s => (
                <form key={s} action={updateDemandStatus.bind(null, id, s)}>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-[10px] text-[13px] font-semibold border transition-colors"
                    style={{
                      borderColor: STATUS_COLORS[s],
                      color: STATUS_COLORS[s],
                      backgroundColor: STATUS_COLORS[s] + '10',
                    }}
                  >
                    → {STATUS_LABELS[s]}
                  </button>
                </form>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="flex gap-2">
              <Link
                href={`/dashboard/demands/${id}/edit`}
                className="px-3 py-1.5 rounded-[10px] text-[13px] font-medium text-[#007AFF] bg-[#007AFF]/8 hover:bg-[#007AFF]/15 transition-colors"
              >
                Edit
              </Link>
              {role === 'admin' && (
                <DeleteButton
                  action={deleteDemand}
                  id={id}
                  confirmMessage={`Delete "${demand.title}"? This cannot be undone.`}
                  label="Delete"
                  className="px-3 py-1.5 rounded-[10px] text-[13px] font-medium text-[#FF3B30] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 transition-colors disabled:opacity-40"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {demand.description && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Description</p>
          <p className="text-[15px] text-black leading-relaxed whitespace-pre-wrap">{demand.description}</p>
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Details</p>
        <DetailRow label="Contract Type" value={demand.contract_type.charAt(0).toUpperCase() + demand.contract_type.slice(1)} />
        <DetailRow label="Location" value={demand.location
          ? `${demand.location}${demand.remote_allowed ? ' · Remote OK' : ''}`
          : demand.remote_allowed ? 'Remote' : undefined} />
        <DetailRow label="Start Date" value={demand.start_date
          ? new Date(demand.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : undefined} />
        <DetailRow label="End Date" value={demand.end_date
          ? new Date(demand.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : undefined} />
        <DetailRow label="Budget" value={
          demand.budget_min || demand.budget_max
            ? demand.budget_min && demand.budget_max
              ? `€${demand.budget_min.toLocaleString()} – €${demand.budget_max.toLocaleString()}`
              : demand.budget_max ? `Up to €${demand.budget_max.toLocaleString()}` : `From €${demand.budget_min?.toLocaleString()}`
            : undefined
        } />
        <DetailRow label="Experience" value={demand.experience_years != null ? `${demand.experience_years}+ years` : undefined} />
      </div>

      {/* Skills */}
      {demand.skills.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Required Skills</p>
          <div className="flex flex-wrap gap-2">
            {demand.skills.map(skill => (
              <span key={skill} className="text-[13px] bg-[#007AFF]/10 text-[#007AFF] px-3 py-1 rounded-full font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Distribution Channels */}
      {demand.channels && demand.channels.length > 0 && canEdit && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Distribution Channels</p>
          <div className="flex flex-wrap gap-2">
            {demand.channels.includes('suppliers') && (
              <span className="flex items-center gap-1.5 text-[13px] bg-[#8E8E93]/10 text-[#3C3C43] px-3 py-1 rounded-full font-medium">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                Supplier Network
              </span>
            )}
            {demand.channels.includes('career_portal') && (
              <span className="flex items-center gap-1.5 text-[13px] bg-[#34C759]/10 text-[#34C759] px-3 py-1 rounded-full font-medium">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                Career Portal
              </span>
            )}
          </div>
        </div>
      )}

      {/* Send to Suppliers */}
      {canSendToSuppliers && (
        <SendToSuppliersPanel
          demandId={id}
          availableSuppliers={allSuppliers}
          sentEntries={sentEntries}
        />
      )}

      {/* Suppliers */}
      {canViewSubmissions && (
        <div className="mt-6">
          <p className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-3 px-1">
            Suppliers
          </p>
          <SuppliersTable demandId={id} />
        </div>
      )}

      {/* Candidate Submissions */}
      {canViewSubmissions && (
        <div className="mt-6">
          <p className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-3 px-1">
            Candidate Submissions
          </p>
          <SubmissionsTable demandId={id} demandSkills={demand.skills} role={role} />
        </div>
      )}

      {/* Meta */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mt-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Meta</p>
        <DetailRow
          label="Created by"
          value={creator?.full_name || creator?.email || '—'}
        />
        <DetailRow
          label="Created"
          value={new Date(demand.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        />
        <DetailRow
          label="Last updated"
          value={new Date(demand.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        />
      </div>
    </div>
  );
}
