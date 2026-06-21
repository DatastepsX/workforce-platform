import { createClient } from '@/lib/supabase/server';
import type { CandidateSubmission, SubmissionStatus, UserRole } from '@/types/database';
import { SubmissionsTableClient, type SubmissionRow } from './submissions-table-client';

function matchScore(candidateSkills: string[], demandSkills: string[]): number | null {
  if (!demandSkills.length) return null;
  if (!candidateSkills.length) return 0;
  const demandLower = demandSkills.map(s => s.toLowerCase());
  const hits = candidateSkills.filter(cs =>
    demandLower.some(d => d.includes(cs.toLowerCase()) || cs.toLowerCase().includes(d))
  );
  return Math.round((hits.length / demandSkills.length) * 100);
}

function matchedSkills(candidateSkills: string[], demandSkills: string[]): string[] {
  const demandLower = demandSkills.map(s => s.toLowerCase());
  return candidateSkills.filter(cs =>
    demandLower.some(d => d.includes(cs.toLowerCase()) || cs.toLowerCase().includes(d))
  );
}

async function getSignedUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string): Promise<string | null> {
  const bucket = path.startsWith('supplier-cvs/') ? 'supplier-cvs' : 'cvs';
  const filePath = path.replace(/^(supplier-cvs|cvs)\//, '');
  const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
  return data?.signedUrl ?? null;
}

interface Props {
  demandId: string;
  demandSkills: string[];
  demandTitle: string;
  demandStartDate: string;
  demandEndDate: string;
  contractType: string;
  role: UserRole;
}

export async function SubmissionsTable({ demandId, demandSkills, demandTitle, demandStartDate, demandEndDate, contractType, role }: Props) {
  const supabase = await createClient();

  const { data: rawSubs } = await supabase
    .from('candidate_submissions')
    .select('*, supplier_candidates(skills, headline, phone, notes, hourly_rate_min, hourly_rate_max, currency), candidate_profiles!candidate_profile_id(full_name, skills, headline, hourly_rate_min, hourly_rate_max, currency)')
    .eq('demand_id', demandId)
    .order('submitted_at', { ascending: false });

  if (!rawSubs?.length) {
    return (
      <SubmissionsTableClient rows={[]} demandSkills={demandSkills} role={role}
        demandTitle={demandTitle} demandStartDate={demandStartDate} demandEndDate={demandEndDate} contractType={contractType} />
    );
  }

  // Supplier names + emails
  const supplierIds = Array.from(new Set(rawSubs.map(s => s.supplier_id).filter(Boolean)));
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, company_name, email')
    .in('id', supplierIds);
  const supplierMap = Object.fromEntries(
    (suppliers ?? []).map(s => [s.id, { name: s.company_name, email: s.email }])
  );

  // Resolve all signed URLs in parallel
  const rows: SubmissionRow[] = await Promise.all(
    rawSubs.map(async s => {
      const sub = s as unknown as CandidateSubmission & {
        source?: string;
        supplier_candidates?: {
          skills: string[];
          headline: string | null;
          phone: string | null;
          notes: string | null;
          hourly_rate_min: number | null;
          hourly_rate_max: number | null;
          currency: string | null;
        } | null;
        candidate_profiles?: {
          full_name: string | null;
          skills: string[];
          headline: string | null;
          hourly_rate_min: number | null;
          hourly_rate_max: number | null;
          currency: string;
        } | null;
      };

      const sc = sub.supplier_candidates;
      const cp = sub.candidate_profiles;

      // For direct applicants (source='direct'), use candidate_profiles skills.
      // For supplier-submitted candidates, use supplier_candidates skills.
      const candidateSkills = sc?.skills?.length ? sc.skills : (cp?.skills ?? []);
      const candidateHeadline = sc?.headline ?? cp?.headline ?? null;

      const score = matchScore(candidateSkills, demandSkills);
      const matched = matchedSkills(candidateSkills, demandSkills);
      const cvPath = sub.cv_path;
      const cvSignedUrl = cvPath ? await getSignedUrl(supabase, cvPath) : null;

      // For direct applicants, prefer the full_name from their profile over stored submission name
      const resolvedName = (sub.source === 'direct' && cp?.full_name && !cp.full_name.includes('@'))
        ? cp.full_name
        : sub.candidate_name;

      return {
        id: sub.id,
        demandId,
        supplierId: sub.supplier_id ?? null,
        supplierName: sub.supplier_id ? (supplierMap[sub.supplier_id]?.name ?? '—') : null,
        supplierEmail: sub.supplier_id ? (supplierMap[sub.supplier_id]?.email ?? null) : null,
        source: (sub.source as 'supplier' | 'direct') ?? 'supplier',
        status: sub.status as SubmissionStatus,
        submittedAt: sub.submitted_at,
        candidateName: resolvedName,
        candidateEmail: sub.candidate_email,
        candidatePhone: sc?.phone ?? null,
        candidateHeadline,
        candidateSkills,
        candidateNotes: sc?.notes ?? null,
        submissionNotes: sub.notes,
        proposedRate: sub.proposed_rate,
        rateType: sub.rate_type,
        cvSignedUrl,
        score,
        matchedSkills: matched,
      };
    })
  );

  // Sort: by score desc, rejected last
  rows.sort((a, b) => {
    const aRej = a.status === 'rejected';
    const bRej = b.status === 'rejected';
    if (aRej !== bRej) return aRej ? 1 : -1;
    if (a.score !== null && b.score !== null) return b.score - a.score;
    if (a.score !== null) return -1;
    if (b.score !== null) return 1;
    return 0;
  });

  return (
    <SubmissionsTableClient
      rows={rows}
      demandSkills={demandSkills}
      role={role}
      demandTitle={demandTitle}
      demandStartDate={demandStartDate}
      demandEndDate={demandEndDate}
      contractType={contractType}
    />
  );
}
