import { createClient } from '@/lib/supabase/server';
import { updateSubmissionStatus } from '@/lib/actions/submissions';
import type { CandidateSubmission, SubmissionStatus, UserRole } from '@/types/database';

const STATUS_META: Record<SubmissionStatus, { label: string; color: string }> = {
  proposed:    { label: 'Proposed',    color: '#8E8E93' },
  shortlisted: { label: 'Shortlisted', color: '#007AFF' },
  interview:   { label: 'Interview',   color: '#FF9500' },
  offer:       { label: 'Offer',       color: '#34C759' },
  hired:       { label: 'Hired',       color: '#34C759' },
  rejected:    { label: 'Rejected',    color: '#FF3B30' },
};

const STATUS_ORDER: SubmissionStatus[] = ['proposed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];

function matchScore(candidateSkills: string[], demandSkills: string[]): number | null {
  if (!demandSkills.length || !candidateSkills.length) return null;
  const demandLower = demandSkills.map(s => s.toLowerCase());
  const hits = candidateSkills.filter(cs =>
    demandLower.some(d => d.includes(cs.toLowerCase()) || cs.toLowerCase().includes(d))
  );
  return Math.round((hits.length / demandSkills.length) * 100);
}

function MatchBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[13px] text-[#C7C7CC]">—</span>;
  const color = score >= 80 ? '#34C759' : score >= 50 ? '#007AFF' : score >= 25 ? '#FF9500' : '#8E8E93';
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1.5 rounded-full bg-[#F2F2F7] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color }}>{score}%</span>
    </div>
  );
}

async function CVDownload({ path }: { path: string }) {
  const supabase = await createClient();
  const bucket = path.startsWith('supplier-cvs/') ? 'supplier-cvs' : 'cvs';
  const filePath = path.replace(/^(supplier-cvs|cvs)\//, '');
  const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
  if (!data?.signedUrl) return <span className="text-[12px] text-[#C7C7CC]">—</span>;
  return (
    <a
      href={data.signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[12px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      CV
    </a>
  );
}

interface Props {
  demandId: string;
  demandSkills: string[];
  role: UserRole;
}

export async function SubmissionsTable({ demandId, demandSkills, role }: Props) {
  const supabase = await createClient();

  const { data: rawSubs } = await supabase
    .from('candidate_submissions')
    .select('*, supplier_candidates(skills, headline)')
    .eq('demand_id', demandId)
    .order('submitted_at', { ascending: false });

  if (!rawSubs?.length) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="w-10 h-10 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-[15px] font-semibold text-black mb-1">No candidates submitted yet</p>
        <p className="text-[13px] text-[#8E8E93]">Suppliers will submit candidates once they respond to this demand.</p>
      </div>
    );
  }

  // Enrich with supplier names
  const supplierIds = Array.from(new Set(rawSubs.map(s => s.supplier_id)));
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, company_name')
    .in('id', supplierIds);
  const supplierMap = Object.fromEntries((suppliers ?? []).map(s => [s.id, s.company_name]));

  type EnrichedSub = CandidateSubmission & {
    supplierName: string;
    candidateSkills: string[];
    candidateHeadline: string | null;
    score: number | null;
  };

  const enriched: EnrichedSub[] = rawSubs.map(s => {
    const sc = (s as typeof s & { supplier_candidates?: { skills: string[]; headline: string | null } | null }).supplier_candidates;
    const candidateSkills = sc?.skills ?? [];
    return {
      ...(s as unknown as CandidateSubmission),
      supplierName: supplierMap[s.supplier_id] ?? '—',
      candidateSkills,
      candidateHeadline: sc?.headline ?? null,
      score: matchScore(candidateSkills, demandSkills),
    };
  });

  // Sort: non-rejected by score desc, then rejected at bottom
  enriched.sort((a, b) => {
    const aRej = a.status === 'rejected';
    const bRej = b.status === 'rejected';
    if (aRej !== bRej) return aRej ? 1 : -1;
    if (a.score !== null && b.score !== null) return b.score - a.score;
    if (a.score !== null) return -1;
    if (b.score !== null) return 1;
    return 0;
  });

  const demandSkillsLower = demandSkills.map(s => s.toLowerCase());
  const canAct = role === 'recruiter' || role === 'admin';

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-[#F2F2F7]">
              <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-5 py-3 w-[200px]">Candidate</th>
              <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[130px]">Via</th>
              <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3">Skills</th>
              <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[100px]">Rate</th>
              <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[110px]">
                <span title="Skill overlap with demand requirements">Match ✦</span>
              </th>
              <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[110px]">Status</th>
              <th className="text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] px-3 py-3 w-[48px]">CV</th>
              {canAct && <th className="px-3 py-3 w-[40px]" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F2F7]">
            {enriched.map(sub => {
              const meta = STATUS_META[sub.status];
              const isRejected = sub.status === 'rejected';
              return (
                <tr key={sub.id} className={`group transition-colors ${isRejected ? 'opacity-50' : 'hover:bg-[#F9F9FB]'}`}>
                  {/* Candidate */}
                  <td className="px-5 py-3.5 align-top">
                    <p className="text-[14px] font-semibold text-black leading-snug">{sub.candidate_name}</p>
                    {sub.candidateHeadline && (
                      <p className="text-[12px] text-[#8E8E93] mt-0.5 leading-snug">{sub.candidateHeadline}</p>
                    )}
                    {sub.candidate_email && (
                      <p className="text-[11px] text-[#C7C7CC] mt-0.5">{sub.candidate_email}</p>
                    )}
                    {sub.notes && (
                      <p className="text-[11px] text-[#3C3C43] mt-1 italic leading-snug">{sub.notes}</p>
                    )}
                  </td>

                  {/* Via */}
                  <td className="px-3 py-3.5 align-top">
                    <span className="text-[13px] text-[#3C3C43]">{sub.supplierName}</span>
                  </td>

                  {/* Skills */}
                  <td className="px-3 py-3.5 align-top">
                    {sub.candidateSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {sub.candidateSkills.map(skill => {
                          const isMatch = demandSkillsLower.some(
                            d => d.includes(skill.toLowerCase()) || skill.toLowerCase().includes(d)
                          );
                          return (
                            <span
                              key={skill}
                              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                              style={
                                isMatch
                                  ? { backgroundColor: '#007AFF18', color: '#007AFF' }
                                  : { backgroundColor: '#F2F2F7', color: '#8E8E93' }
                              }
                            >
                              {skill}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#C7C7CC]">—</span>
                    )}
                  </td>

                  {/* Rate */}
                  <td className="px-3 py-3.5 align-top">
                    {sub.proposed_rate ? (
                      <div>
                        <span className="text-[14px] font-semibold text-black">
                          €{sub.proposed_rate.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-[#8E8E93] ml-1">/{sub.rate_type ?? 'day'}</span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#C7C7CC]">—</span>
                    )}
                  </td>

                  {/* Match */}
                  <td className="px-3 py-3.5 align-top">
                    <MatchBadge score={sub.score} />
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3.5 align-top">
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: meta.color + '18', color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </td>

                  {/* CV */}
                  <td className="px-3 py-3.5 align-top">
                    {sub.cv_path ? (
                      <CVDownload path={sub.cv_path} />
                    ) : (
                      <span className="text-[12px] text-[#C7C7CC]">—</span>
                    )}
                  </td>

                  {/* Actions dropdown */}
                  {canAct && (
                    <td className="px-3 py-3.5 align-top">
                      <details className="relative group/dd">
                        <summary className="list-none cursor-pointer w-7 h-7 rounded-lg flex items-center justify-center text-[#C7C7CC] hover:text-[#8E8E93] hover:bg-[#F2F2F7] transition-colors">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                          </svg>
                        </summary>
                        <div className="absolute right-0 top-8 z-10 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#F2F2F7] py-1 min-w-[160px]">
                          {STATUS_ORDER.filter(s => s !== sub.status).map(s => (
                            <form key={s} action={updateSubmissionStatus.bind(null, sub.id, s, demandId)}>
                              <button
                                type="submit"
                                className="w-full text-left text-[13px] px-4 py-2 hover:bg-[#F2F2F7] transition-colors flex items-center gap-2"
                                style={{ color: STATUS_META[s].color }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_META[s].color }} />
                                {STATUS_META[s].label}
                              </button>
                            </form>
                          ))}
                        </div>
                      </details>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer legend */}
      <div className="px-5 py-3 border-t border-[#F2F2F7] flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#007AFF]/30" />
          <span className="text-[11px] text-[#8E8E93]">Skill matches demand requirement</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#8E8E93]">✦ Match = skill overlap with required skills · AI ranking coming soon</span>
        </div>
      </div>
    </div>
  );
}
