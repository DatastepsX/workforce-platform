import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { updateEngagementStatus } from '@/lib/actions/engagements';
import type { Engagement, EngagementStatus } from '@/types/database';

const STATUS_META: Record<EngagementStatus, { label: string; color: string }> = {
  active:    { label: 'Active',    color: '#34C759' },
  completed: { label: 'Completed', color: '#007AFF' },
  cancelled: { label: 'Cancelled', color: '#FF3B30' },
};

const RATE_TYPE_LABELS: Record<string, string> = {
  daily: 'pro Tag', hourly: 'pro Stunde', monthly: 'pro Monat', fixed: 'Pauschal',
};

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F2F2F7] last:border-0">
      <span className="text-[14px] text-[#8E8E93] font-medium min-w-[140px] flex-shrink-0">{label}</span>
      <span className="text-[14px] text-black text-right flex-1">{value}</span>
    </div>
  );
}

interface EngagementWithRelations extends Engagement {
  supplier_detail: {
    id: string;
    company_name: string;
    email: string | null;
    phone: string | null;
    contact_person: string | null;
  } | null;
  submission_detail: {
    id: string;
    candidate_profile_id: string | null;
    proposed_rate: number | null;
    rate_type: string | null;
    notes: string | null;
    source: string | null;
  } | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EngagementDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['super_admin', 'admin', 'recruiter', 'hiring_manager'].includes(profile?.role ?? '')) redirect('/dashboard');

  const { data: engData } = await supabase
    .from('engagements')
    .select('*')
    .eq('id', id)
    .single();

  if (!engData) notFound();
  const engBase = engData as Engagement;

  // Fetch related supplier + submission in parallel (best-effort, may be null due to RLS)
  const [{ data: supData }, { data: subData }] = await Promise.all([
    engBase.supplier_id
      ? supabase.from('suppliers').select('id, company_name, email, phone, contact_person').eq('id', engBase.supplier_id).single()
      : Promise.resolve({ data: null }),
    engBase.submission_id
      ? supabase.from('candidate_submissions').select('id, candidate_profile_id, proposed_rate, rate_type, notes, source').eq('id', engBase.submission_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const eng: EngagementWithRelations = {
    ...engBase,
    supplier_detail: supData as EngagementWithRelations['supplier_detail'] ?? null,
    submission_detail: subData as EngagementWithRelations['submission_detail'] ?? null,
  };

  const meta = STATUS_META[eng.status];
  const sub = eng.submission_detail;
  const sup = eng.supplier_detail;

  const calendarDays = eng.start_date && eng.end_date
    ? Math.round((new Date(eng.end_date).getTime() - new Date(eng.start_date).getTime()) / 86400000) + 1
    : null;

  // Count business days
  let businessDays: number | null = null;
  if (eng.start_date && eng.end_date) {
    let count = 0;
    const cur = new Date(eng.start_date);
    const end = new Date(eng.end_date);
    while (cur <= end) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    businessDays = count;
  }

  const totalCost = eng.rate && businessDays
    ? (eng.rate_type === 'daily'   ? eng.rate * businessDays
     : eng.rate_type === 'hourly'  ? eng.rate * businessDays * 8
     : eng.rate_type === 'monthly' ? eng.rate * (businessDays / 21)
     : eng.rate)
    : null;

  return (
    <div className="px-8 py-10 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/engagements" className="hover:text-[#007AFF] transition-colors">Engagements</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-black font-medium truncate">{eng.candidate_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: meta.color + '18', color: meta.color }}>
              {meta.label}
            </span>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-black leading-tight">{eng.candidate_name}</h1>
          <p className="text-[15px] text-[#8E8E93] mt-1">{eng.demand_title}</p>
        </div>
        {eng.rate && (
          <div className="text-right flex-shrink-0">
            <p className="text-[28px] font-bold text-black">{eng.currency} {eng.rate.toLocaleString('de-DE')}</p>
            <p className="text-[13px] text-[#8E8E93]">{RATE_TYPE_LABELS[eng.rate_type ?? ''] ?? eng.rate_type}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Candidate card */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Kandidat</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-[15px] font-bold flex-shrink-0">
              {eng.candidate_name[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-[15px] font-bold text-black">{eng.candidate_name}</p>
              {eng.candidate_email && (
                <a href={`mailto:${eng.candidate_email}`} className="text-[13px] text-[#007AFF] hover:underline">
                  {eng.candidate_email}
                </a>
              )}
            </div>
          </div>
          {sub?.source === 'direct' && sub.candidate_profile_id && (
            <Link
              href={`/dashboard/candidates/${sub.candidate_profile_id}`}
              className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-[#007AFF]/8 text-[13px] font-semibold text-[#007AFF] hover:bg-[#007AFF]/15 transition-colors"
            >
              Kandidatenprofil anzeigen
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          )}
          {sub?.source === 'supplier' && (
            <p className="text-[12px] text-[#8E8E93] italic">Eingereicht durch Lieferant</p>
          )}
        </div>

        {/* Supplier card */}
        {(sup || eng.supplier_name) && (
          <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Lieferant</p>
            <p className="text-[15px] font-bold text-black mb-1">{sup?.company_name ?? eng.supplier_name}</p>
            {sup?.contact_person && <p className="text-[13px] text-[#3C3C43] mb-2">{sup.contact_person}</p>}
            <div className="space-y-1.5">
              {sup?.email && (
                <a href={`mailto:${sup.email}`} className="flex items-center gap-2 text-[13px] text-[#007AFF] hover:underline">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
                  {sup.email}
                </a>
              )}
              {sup?.phone && (
                <a href={`tel:${sup.phone}`} className="flex items-center gap-2 text-[13px] text-[#007AFF] hover:underline">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.09 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l1.27-.95a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                  {sup.phone}
                </a>
              )}
            </div>
            {eng.supplier_id && (
              <Link
                href={`/dashboard/suppliers/${eng.supplier_id}/edit`}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-[#F2F2F7] text-[13px] font-semibold text-[#3C3C43] hover:bg-[#E5E5EA] transition-colors mt-3"
              >
                Lieferant bearbeiten
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* What was offered */}
      {sub && (sub.proposed_rate || sub.notes) && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Angebot (Submission)</p>
          {sub.proposed_rate && (
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[22px] font-bold text-black">
                {sub.proposed_rate.toLocaleString('de-DE')} {eng.currency}
              </span>
              <span className="text-[14px] text-[#8E8E93]">
                {RATE_TYPE_LABELS[sub.rate_type ?? ''] ?? sub.rate_type ?? '/ Tag'}
              </span>
            </div>
          )}
          {sub.notes && (
            <p className="text-[14px] text-[#3C3C43] leading-relaxed whitespace-pre-wrap mt-2">{sub.notes}</p>
          )}
        </div>
      )}

      {/* Cost summary */}
      {eng.rate && businessDays && (
        <div className="bg-gradient-to-br from-[#007AFF]/8 to-[#007AFF]/4 rounded-2xl p-5 border border-[#007AFF]/15 mb-4">
          <p className="text-[12px] font-semibold text-[#007AFF] uppercase tracking-[0.6px] mb-4">Kostenkalkulation</p>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="text-center">
              <p className="text-[26px] font-bold text-black">{calendarDays}</p>
              <p className="text-[11px] text-[#8E8E93]">Kal. Tage</p>
            </div>
            <p className="text-[18px] text-[#C7C7CC]">−</p>
            <div className="text-center">
              <p className="text-[26px] font-bold text-[#8E8E93]">{(calendarDays ?? 0) - businessDays}</p>
              <p className="text-[11px] text-[#8E8E93]">Wochenend.</p>
            </div>
            <p className="text-[18px] text-[#C7C7CC]">=</p>
            <div className="text-center">
              <p className="text-[26px] font-bold text-[#007AFF]">{businessDays}</p>
              <p className="text-[11px] text-[#007AFF]">Arbeitstage</p>
            </div>
            <div className="flex-1 min-w-[160px]">
              <p className="text-[12px] text-[#8E8E93] text-right">
                {eng.rate_type === 'daily'   && `${businessDays} Tage × ${eng.rate.toLocaleString('de-DE')} ${eng.currency}/Tag`}
                {eng.rate_type === 'hourly'  && `${businessDays} Tage × 8h × ${eng.rate.toLocaleString('de-DE')} ${eng.currency}/Std.`}
                {eng.rate_type === 'monthly' && `${(businessDays / 21).toFixed(1)} Mo. × ${eng.rate.toLocaleString('de-DE')} ${eng.currency}/Monat`}
              </p>
            </div>
          </div>
          <div className="bg-white/70 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-[#3C3C43]">Gesamtvolumen</p>
                {eng.price_locked ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF9500]/15 text-[#FF9500] uppercase tracking-wide">
                    Preis festgelegt
                  </span>
                ) : (
                  <span className="text-[10px] text-[#8E8E93]">berechnet</span>
                )}
              </div>
              <p className="text-[22px] font-bold text-black">
                {eng.currency} {(eng.total_amount ?? totalCost)?.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
              </p>
            </div>
            {eng.price_locked && eng.total_amount && totalCost && Math.round(eng.total_amount) !== Math.round(totalCost) && (
              <p className="text-[11px] text-[#8E8E93]">
                Kalkulation ergäbe: {eng.currency} {Math.round(totalCost).toLocaleString('de-DE')} · Manuell auf {eng.currency} {Math.round(eng.total_amount).toLocaleString('de-DE')} festgelegt
              </p>
            )}
          </div>
          {fmt(eng.start_date) && (
            <p className="text-[11px] text-[#8E8E93] mt-2 text-right">
              {fmt(eng.start_date)} → {fmt(eng.end_date)} · Wochenenden ausgeschlossen
            </p>
          )}
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Details</p>
        <Row label="Demand" value={
          <Link href={`/dashboard/demands/${eng.demand_id}`} className="text-[#007AFF] hover:underline">
            {eng.demand_title}
          </Link>
        } />
        <Row label="Start" value={fmt(eng.start_date)} />
        <Row label="Ende" value={fmt(eng.end_date)} />
        <Row label="Erstellt" value={
          new Date(eng.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        } />
      </div>

      {/* Notes */}
      {eng.notes && (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Notizen</p>
          <p className="text-[15px] text-black leading-relaxed whitespace-pre-wrap">{eng.notes}</p>
        </div>
      )}

      {/* Status actions */}
      {eng.status === 'active' && (
        <div className="flex gap-3 mt-2">
          <form action={updateEngagementStatus.bind(null, id, 'completed')}>
            <button type="submit" className="px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#007AFF', boxShadow: '0 2px 8px rgba(0,122,255,0.3)' }}>
              Als abgeschlossen markieren
            </button>
          </form>
          <form action={updateEngagementStatus.bind(null, id, 'cancelled')}>
            <button type="submit" className="px-5 py-2.5 rounded-[10px] text-[14px] font-semibold text-[#FF3B30] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 transition-colors">
              Stornieren
            </button>
          </form>
        </div>
      )}
      {eng.status === 'cancelled' && (
        <form action={updateEngagementStatus.bind(null, id, 'active')}>
          <button type="submit" className="px-5 py-2.5 rounded-[10px] text-white text-[14px] font-semibold"
            style={{ backgroundColor: '#34C759' }}>
            Reaktivieren
          </button>
        </form>
      )}
    </div>
  );
}
