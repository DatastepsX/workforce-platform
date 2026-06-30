import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { deleteDemand } from '@/lib/actions/demands';
import { getAwardsByDemand } from '@/lib/actions/awards';
import { SendToSuppliersPanel } from './send-to-suppliers';
import { SuppliersTable } from './suppliers-table';
import { SubmissionsTable } from './submissions-table';
import { DeleteButton } from '@/components/DeleteButton';
import { DemandReadMarker } from './demand-read-marker';
import { MarkDemandUnreadButton } from './mark-unread-button';
import type { Demand, UserRole, Supplier, DemandSupplier, Engagement, EngagementStatus, ProcessHistoryEntry, TenantConfig, Award, AwardStatus } from '@/types/database';
import { SocialMediaTab } from './social-media-tab';
import { ProcessPanel } from './process-panel';
import { getDemandHistory, getTenantConfig } from '@/lib/actions/workflow';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/workflow';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#8E8E93', medium: '#007AFF', high: '#FF9500', urgent: '#FF3B30',
};

// Statuses before sourcing — the panel is shown but locked (no sending yet)
const PRE_SOURCING_STATUSES: string[] = ['draft', 'pending_review', 'pending_approval'];

// Explains why the Send to Suppliers panel is locked for a given status
function sendLockedReason(status: string): string {
  switch (status) {
    case 'draft':
      return 'This demand is still a draft. It can be sent to suppliers once it has been submitted and cleared review and approval.';
    case 'pending_review':
      return 'This demand is in MSP review. It can be sent to suppliers once review (and any required approval) is complete.';
    case 'pending_approval':
      return 'This demand is awaiting approval. It can be sent to suppliers once it is fully approved.';
    case 'screening':
      return 'This demand is in screening. Return it to sourcing to send it to additional suppliers.';
    case 'on_hold':
      return 'This demand is on hold. Resume it to continue sourcing.';
    default:
      return 'This demand is no longer in the sourcing stage, so it can no longer be sent to suppliers.';
  }
}

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
  const isApproverRole = ['procurement', 'finance'].includes(role);
  const isHM = role === 'hiring_manager';
  const isOwnDemand = demand.created_by === user.id;
  const canEdit = isOwnDemand ||
    ['super_admin', 'recruiter', 'admin'].includes(role) ||
    (isApproverRole && demand.status === 'pending_approval') ||
    (isHM && demand.status === 'pending_approval');
  // Who can manage (send/assign) suppliers
  const canSendToSuppliers = ['super_admin', 'recruiter', 'admin'].includes(role) ||
    (isHM && isOwnDemand) ||
    (isApproverRole && demand.status === 'pending_approval') ||
    (isHM && demand.status === 'pending_approval');
  const canViewSubmissions = ['super_admin', 'recruiter', 'admin', 'hiring_manager', 'procurement', 'finance'].includes(role);

  // Fetch creator profile separately (created_by → auth.users, no direct FK to profiles)
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', demand.created_by)
    .single();
  const creator = creatorProfile as { full_name: string | null; email: string | null } | null;

  // Fetch suppliers + existing demand_suppliers for the send panel (use admin client to bypass RLS for all roles including hiring_manager)
  const adminDb = createAdminClient();
  let suppliersData: Supplier[] | null = null;
  let sentData = null;
  if (canSendToSuppliers || isApproverRole) {
    const [suppliersRes, sentRes] = await Promise.all([
      // If demand is tenant-scoped, only show suppliers assigned & active for that tenant
      demand.tenant_id
        ? adminDb.from('tenant_suppliers')
            .select('supplier_id')
            .eq('tenant_id', demand.tenant_id)
            .eq('active', true)
            .then(async ({ data: ts }) => {
              const ids = (ts ?? []).map((r: { supplier_id: string }) => r.supplier_id);
              if (!ids.length) return { data: [] };
              return adminDb.from('suppliers').select('*').in('id', ids).order('company_name');
            })
        : adminDb.from('suppliers').select('*').order('company_name'),
      adminDb.from('demand_suppliers').select('*').eq('demand_id', id),
    ]);
    suppliersData = (suppliersRes.data ?? []) as Supplier[];
    sentData = sentRes.data;
  }

  const allSuppliers = (suppliersData ?? []) as Supplier[];
  const sentEntries = ((sentData ?? []) as DemandSupplier[]).map(entry => ({
    ...entry,
    supplier: allSuppliers.find(s => s.id === entry.supplier_id)!,
  })).filter(e => e.supplier);

  // Fetch process history + tenant config for ProcessPanel
  let processHistory: ProcessHistoryEntry[] = [];
  let tenantConfig: TenantConfig | null = null;
  if (['super_admin', 'admin', 'recruiter', 'hiring_manager', 'procurement', 'finance'].includes(role)) {
    [processHistory, tenantConfig] = await Promise.all([
      getDemandHistory(id) as Promise<ProcessHistoryEntry[]>,
      getTenantConfig(demand.tenant_id),
    ]);
  }

  // Fetch engagements for this demand
  let engagements: Engagement[] = [];
  if (canViewSubmissions) {
    const { data: engData } = await supabase
      .from('engagements')
      .select('*')
      .eq('demand_id', id)
      .order('created_at', { ascending: false });
    engagements = (engData ?? []) as Engagement[];
  }

  // Fetch awards for this demand
  let awards: Award[] = [];
  if (canViewSubmissions) {
    awards = await getAwardsByDemand(id);
  }

  const AWARD_STATUS_META: Record<AwardStatus, { label: string; color: string }> = {
    pending_approval: { label: 'Pending Approval', color: '#FF9500' },
    approved:         { label: 'Approved',          color: '#007AFF' },
    active:           { label: 'Active',            color: '#34C759' },
    completed:        { label: 'Completed',         color: '#8E8E93' },
    cancelled:        { label: 'Cancelled',         color: '#FF3B30' },
  };

  const ENG_STATUS_META: Record<EngagementStatus, { label: string; color: string }> = {
    active:    { label: 'Active',    color: '#34C759' },
    completed: { label: 'Completed', color: '#007AFF' },
    cancelled: { label: 'Cancelled', color: '#FF3B30' },
  };

  function fmtDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }


  return (
    <div className="px-8 py-10 max-w-3xl">
      <DemandReadMarker demandId={id} />
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/demands" className="hover:text-[#007AFF] transition-colors">Demands</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-black font-medium">{demand.title}</span>
      </div>

      {/* Hired banner */}
      {engagements.length > 0 && (
        <div className="bg-[#34C759]/8 border border-[#34C759]/25 rounded-2xl px-5 py-4 mb-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#34C759] flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#1C7B3A]">Position Filled</p>
            <p className="text-[13px] text-[#3C3C43]">
              <span className="font-semibold">{engagements[0].candidate_name}</span>
              {' '}has been awarded
              {engagements[0].start_date ? ` · Starting ${fmtDate(engagements[0].start_date)}` : ''}
            </p>
          </div>
          <Link
            href={`/dashboard/engagements/${engagements[0].id}`}
            className="text-[13px] font-semibold text-[#007AFF] hover:underline whitespace-nowrap flex-shrink-0"
          >
            View Award →
          </Link>
        </div>
      )}

      {/* Process Panel */}
      {['super_admin', 'admin', 'recruiter', 'hiring_manager', 'procurement', 'finance'].includes(role) && tenantConfig && (
        <ProcessPanel
          demandId={id}
          status={demand.status}
          approvalLevel={demand.approval_level}
          role={role}
          config={tenantConfig}
          history={processHistory}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
        <div className="flex flex-col items-start sm:items-end gap-2">
          {canEdit && (
            <div className="flex gap-2 flex-wrap">
              {['admin', 'recruiter'].includes(role ?? '') && (
                <MarkDemandUnreadButton demandId={id} />
              )}
              <Link
                href={`/dashboard/demands/${id}/edit`}
                className="px-3 py-1.5 rounded-[10px] text-[13px] font-medium text-[#007AFF] bg-[#007AFF]/8 hover:bg-[#007AFF]/15 transition-colors"
              >
                Edit
              </Link>
              {['admin', 'super_admin'].includes(role) && (
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
        {demand.billing_period_type && (
          <DetailRow label="Billing Period" value={demand.billing_period_type.replace('_', '-').replace(/^\w/, c => c.toUpperCase())} />
        )}
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

      {/* Send to Suppliers / Pre-assign during review */}
      {canSendToSuppliers && (demand.status === 'sourcing' || demand.status === 'pending_review' || demand.status === 'pending_approval' || sentEntries.length > 0 || PRE_SOURCING_STATUSES.includes(demand.status)) && (
        <SendToSuppliersPanel
          demandId={id}
          availableSuppliers={allSuppliers}
          sentEntries={sentEntries}
          canSend={demand.status === 'sourcing'}
          canAssign={
            (demand.status === 'pending_review' && ['super_admin', 'admin', 'recruiter'].includes(role)) ||
            (demand.status === 'pending_approval' && (isApproverRole || isHM || ['super_admin', 'admin', 'recruiter'].includes(role)))
          }
          canRemove={
            (demand.status === 'pending_review' && ['super_admin', 'admin', 'recruiter'].includes(role)) ||
            (demand.status === 'pending_approval' && (isApproverRole || isHM || ['super_admin', 'admin', 'recruiter'].includes(role)))
          }
          lockedReason={demand.status === 'sourcing' || demand.status === 'pending_review' || demand.status === 'pending_approval' ? null : sendLockedReason(demand.status)}
        />
      )}


      {/* Awaiting submissions banner — shown when sourcing and suppliers have been notified */}
      {demand.status === 'sourcing' && canViewSubmissions && sentEntries.filter(e => e.status !== 'preassigned').length > 0 && (
        <div className="mt-4 bg-[#007AFF]/8 border border-[#007AFF]/20 rounded-2xl px-5 py-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4m0 4h.01"/>
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#007AFF] mb-0.5">Awaiting Supplier Submissions</p>
            <p className="text-[13px] text-[#3C3C43]">
              {(() => { const n = sentEntries.filter(e => e.status !== 'preassigned').length; return `This demand has been sent to ${n} supplier${n !== 1 ? 's' : ''}.`; })()}
              {' '}Candidates will appear in the submissions table below as suppliers respond.
            </p>
          </div>
        </div>
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
          <SubmissionsTable
            demandId={id}
            demandSkills={demand.skills}
            demandTitle={demand.title}
            demandStartDate={demand.start_date ?? ''}
            demandEndDate={demand.end_date ?? ''}
            contractType={demand.contract_type ?? 'contractor'}
            demandStatus={demand.status}
            role={role}
            canAward={
              ['admin', 'super_admin'].includes(role) ||
              (role === 'recruiter' && (tenantConfig?.award_msp_offer ?? true)) ||
              (role === 'hiring_manager' && !(tenantConfig?.award_msp_offer ?? true))
            }
          />
        </div>
      )}

      {/* Awards */}
      {canViewSubmissions && awards.length > 0 && (
        <div className="mt-6">
          <p className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-3 px-1">
            Awards
          </p>
          <div className="space-y-3">
            {awards.map(award => {
              const m = AWARD_STATUS_META[award.status as AwardStatus] ?? AWARD_STATUS_META.pending_approval;
              return (
                <Link key={award.id} href={`/dashboard/awards/${award.id}`}>
                  <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_16px_rgba(0,0,0,0.1)] transition-shadow flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: m.color + '18', color: m.color }}
                        >
                          {m.label}
                        </span>
                      </div>
                      <p className="text-[15px] font-bold text-black">{award.candidate_name}</p>
                      {award.supplier_name && (
                        <p className="text-[13px] text-[#8E8E93]">via {award.supplier_name}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {award.rate && (
                        <p className="text-[15px] font-bold text-black">
                          {award.currency} {award.rate.toLocaleString()}
                          <span className="text-[12px] font-normal text-[#8E8E93] ml-1">/{award.rate_type}</span>
                        </p>
                      )}
                      {award.total_amount && (
                        <p className="text-[12px] text-[#8E8E93]">Total {award.currency} {award.total_amount.toLocaleString()}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-[#C7C7CC] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Engagements */}
      {canViewSubmissions && engagements.length > 0 && (
        <div className="mt-6">
          <p className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-3 px-1">
            Engagements
          </p>
          <div className="space-y-3">
            {engagements.map(eng => {
              const m = ENG_STATUS_META[eng.status];
              return (
                <Link key={eng.id} href={`/dashboard/engagements/${eng.id}`}>
                  <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_16px_rgba(0,0,0,0.1)] transition-shadow flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: m.color + '18', color: m.color }}
                        >
                          {m.label}
                        </span>
                      </div>
                      <p className="text-[15px] font-bold text-black">{eng.candidate_name}</p>
                      {eng.supplier_name && (
                        <p className="text-[13px] text-[#8E8E93]">via {eng.supplier_name}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {eng.rate && (
                        <p className="text-[15px] font-bold text-black">
                          {eng.currency} {eng.rate.toLocaleString()}
                          <span className="text-[12px] font-normal text-[#8E8E93] ml-1">/{eng.rate_type}</span>
                        </p>
                      )}
                      {(eng.start_date || eng.end_date) && (
                        <p className="text-[12px] text-[#8E8E93] mt-0.5">
                          {fmtDate(eng.start_date) ?? '?'}{eng.end_date ? ` – ${fmtDate(eng.end_date)}` : ''}
                        </p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-[#C7C7CC] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Social Media */}
      {demand.channels?.includes('career_portal') && canViewSubmissions && (
        <div className="mt-6">
          <p className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-3 px-1">
            Social Media
          </p>
          <SocialMediaTab demand={demand} canEdit={canEdit} />
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
