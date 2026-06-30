import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type {
  CandidateCareerPath, CareerPathStep, CareerSkillGap,
  CareerRecommendation, SoftSkillRating, CareerLadder, CareerLadderStep,
} from '@/types/database';
import { SOFT_SKILL_LABELS, SOFT_SKILLS } from '@/types/database';
import { SkillRadar } from '../profile/skill-radar';

const REC_ICONS: Record<string, string> = {
  course:        '📚',
  certification: '🏅',
  project:       '🔧',
  mentoring:     '🤝',
};

const REC_LABELS: Record<string, string> = {
  course:        'Kurs',
  certification: 'Zertifizierung',
  project:       'Projekt',
  mentoring:     'Mentoring',
};

function matchColor(pct: number) {
  if (pct >= 80) return '#34C759';
  if (pct >= 60) return '#FF9500';
  if (pct >= 40) return '#FFCC00';
  return '#8E8E93';
}

function computeLadderMatch(steps: CareerLadderStep[], candidateSkills: string[]): number {
  const seen = new Set<string>();
  const allRequired = steps.flatMap(s => (s.required_skills ?? []).map(r => r.toLowerCase().trim())).filter(r => { if (seen.has(r)) return false; seen.add(r); return true; });
  if (allRequired.length === 0) return 0;
  const matched = allRequired.filter(req =>
    candidateSkills.some(cs => cs.includes(req) || req.includes(cs))
  );
  return Math.round((matched.length / allRequired.length) * 100);
}

function StepCard({
  step, gap, demandMap, isCurrent,
}: {
  step: CareerPathStep;
  gap: CareerSkillGap | undefined;
  demandMap: Record<string, { title: string }>;
  isCurrent: boolean;
}) {
  const matchingDemands = (step.matching_demand_ids ?? [])
    .map(id => demandMap[id]).filter(Boolean);

  return (
    <div className="relative pl-10">
      <div
        className="absolute left-0 top-5 w-6 h-6 rounded-full border-2 flex items-center justify-center -translate-x-1/2"
        style={isCurrent
          ? { backgroundColor: '#007AFF', borderColor: '#007AFF' }
          : { backgroundColor: 'white', borderColor: '#C7C7CC' }
        }
      >
        {isCurrent && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
      </div>

      <div
        className="rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-1"
        style={{ backgroundColor: isCurrent ? '#007AFF0D' : 'white', borderLeft: isCurrent ? '3px solid #007AFF' : 'none' }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[16px] font-semibold text-black">{step.title}</h3>
              {isCurrent && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#007AFF' }}>
                  Aktuelle Position
                </span>
              )}
              {step.estimated_duration_months && !isCurrent && (
                <span className="text-[11px] text-[#8E8E93] bg-[#F2F2F7] px-2 py-0.5 rounded-full">
                  ~{step.estimated_duration_months} Monate
                </span>
              )}
            </div>
            {step.description && (
              <p className="text-[13px] text-[#3C3C43] mt-1.5 leading-relaxed">{step.description}</p>
            )}
          </div>
        </div>

        {step.required_skills.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Benötigte Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {step.required_skills.map(s => (
                <span key={s} className="text-[12px] px-2.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: '#007AFF15', color: '#007AFF' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {matchingDemands.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Passende offene Stellen</p>
            <div className="space-y-1.5">
              {(step.matching_demand_ids ?? []).map(id => {
                const d = demandMap[id];
                if (!d) return null;
                return (
                  <Link key={id} href={`/careers/${id}`} target="_blank"
                    className="flex items-center gap-2 text-[13px] text-[#007AFF] hover:underline">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] flex-shrink-0" />
                    {d.title}
                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14"/>
                    </svg>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {matchingDemands.length === 0 && !isCurrent && (
          <div className="mb-3">
            <span className="text-[11px] text-[#8E8E93] bg-[#F2F2F7] px-2.5 py-1 rounded-full inline-block">
              Generischer Karriereschritt
            </span>
          </div>
        )}

        {gap && gap.missing_skills.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#F2F2F7]">
            <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Skill-Lücken</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {gap.missing_skills.map(s => (
                <span key={s} className="text-[12px] px-2.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: '#FF950015', color: '#FF9500' }}>
                  {s}
                </span>
              ))}
            </div>

            {gap.recommendations.length > 0 && (
              <>
                <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px] mb-2">Empfehlungen</p>
                <div className="space-y-2">
                  {gap.recommendations.map((rec: CareerRecommendation, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-[13px]">
                      <span className="text-base leading-none mt-0.5">{REC_ICONS[rec.type] ?? '📌'}</span>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8E8E93] mr-1.5">
                          {REC_LABELS[rec.type]}
                        </span>
                        <span className="font-medium text-black">{rec.title}</span>
                        {rec.description && (
                          <p className="text-[#8E8E93] text-[12px] mt-0.5">{rec.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step.rationale && (
          <details className="mt-3">
            <summary className="text-[12px] text-[#8E8E93] cursor-pointer hover:text-[#007AFF] select-none">
              Warum dieser Schritt?
            </summary>
            <p className="text-[12px] text-[#3C3C43] mt-2 leading-relaxed">{step.rationale}</p>
          </details>
        )}
      </div>
    </div>
  );
}

type LadderWithSteps = CareerLadder & { career_ladder_steps: CareerLadderStep[] };

function LadderCard({ ladder, candidateSkills, isRecommended }: {
  ladder: LadderWithSteps;
  candidateSkills: string[];
  isRecommended: boolean;
}) {
  const steps = [...ladder.career_ladder_steps].sort((a, b) => a.position - b.position);
  const match = computeLadderMatch(steps, candidateSkills);
  const color = matchColor(match);

  return (
    <div
      className="rounded-2xl border bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
      style={{ borderColor: isRecommended ? '#007AFF40' : '#E5E5EA', backgroundColor: isRecommended ? '#007AFF05' : 'white' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-black">{ladder.name}</h3>
            {isRecommended && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#007AFF' }}>
                KI-Empfehlung
              </span>
            )}
          </div>
          {ladder.industry && (
            <p className="text-[12px] text-[#8E8E93] mt-0.5">{ladder.industry}</p>
          )}
          {ladder.description && (
            <p className="text-[12px] text-[#3C3C43] mt-1 leading-relaxed">{ladder.description}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[22px] font-bold leading-tight" style={{ color }}>{match}%</div>
          <div className="text-[10px] text-[#8E8E93]">Skill-Match</div>
        </div>
      </div>

      {/* Match bar */}
      <div className="h-1.5 rounded-full bg-[#F2F2F7] mb-4 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${match}%`, backgroundColor: color }} />
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.5px]">
            {steps.length} Karrierestufen
          </p>
          {steps.map(step => {
            const stepSkills = step.required_skills ?? [];
            const haveSkills = stepSkills.filter(s =>
              candidateSkills.some(cs => cs.includes(s.toLowerCase()) || s.toLowerCase().includes(cs))
            );
            const missingSkills = stepSkills.filter(s =>
              !candidateSkills.some(cs => cs.includes(s.toLowerCase()) || s.toLowerCase().includes(cs))
            );
            return (
              <div key={step.id} className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[11px] font-bold text-[#8E8E93] mt-0.5">
                  {step.position}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-black leading-snug">{step.title}</p>
                  {stepSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {haveSkills.map(s => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: '#34C75912', color: '#34C759' }}>
                          ✓ {s}
                        </span>
                      ))}
                      {missingSkills.map(s => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: '#F2F2F7', color: '#8E8E93' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default async function CareerNavigatorPage() {
  const supabase = await createClient();
  const adminDb = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileData?.role !== 'candidate') redirect('/dashboard');

  const [, { data: pathData }, { data: ratingsData }, { data: laddersData }, { data: candidateProfileData }] = await Promise.all([
    supabase.from('candidate_profiles').select('id').eq('id', user.id).single(),
    supabase.from('candidate_career_paths')
      .select('*')
      .eq('candidate_profile_id', user.id)
      .eq('is_current', true)
      .single(),
    supabase.from('soft_skill_ratings').select('*').eq('candidate_profile_id', user.id),
    adminDb.from('career_ladders').select('*, career_ladder_steps(*)').order('name'),
    supabase.from('candidate_profiles').select('skills').eq('id', user.id).single(),
  ]);

  const path = pathData as CandidateCareerPath | null;
  const ratings = (ratingsData ?? []) as SoftSkillRating[];
  const ladders = (laddersData ?? []) as LadderWithSteps[];
  const candidateSkills = (candidateProfileData?.skills ?? []).map((s: string) => s.toLowerCase().trim());

  const selfRatings = Object.fromEntries(ratings.filter(r => r.self_rating != null).map(r => [r.skill, r.self_rating!]));
  const aiRatings   = Object.fromEntries(ratings.filter(r => r.ai_rating  != null).map(r => [r.skill, r.ai_rating!]));

  let gapMap: Record<number, CareerSkillGap> = {};
  let demandMap: Record<string, { title: string }> = {};

  if (path) {
    const { data: gaps } = await supabase
      .from('career_skill_gaps').select('*').eq('career_path_id', path.id);
    gapMap = Object.fromEntries((gaps ?? []).map(g => [g.step_position, g as CareerSkillGap]));

    const demandIds = path.steps.flatMap(s => s.matching_demand_ids ?? []).filter(Boolean);
    if (demandIds.length > 0) {
      const { data: demands } = await supabase
        .from('demands').select('id, title').in('id', demandIds);
      demandMap = Object.fromEntries((demands ?? []).map(d => [d.id, { title: d.title }]));
    }
  }

  const hasRadar = Object.keys(selfRatings).length > 0 || Object.keys(aiRatings).length > 0;

  // Sort ladders: recommended first, then by match score
  const sortedLadders = [...ladders].sort((a, b) => {
    const aRec = path?.base_ladder_id === a.id ? 1 : 0;
    const bRec = path?.base_ladder_id === b.id ? 1 : 0;
    if (aRec !== bRec) return bRec - aRec;
    const aMatch = computeLadderMatch(a.career_ladder_steps, candidateSkills);
    const bMatch = computeLadderMatch(b.career_ladder_steps, candidateSkills);
    return bMatch - aMatch;
  });

  return (
    <div className="px-6 py-10 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Career Navigator</h1>
          {path?.title && (
            <p className="text-[16px] text-[#3C3C43] mt-0.5">{path.title}</p>
          )}
          {path?.summary && (
            <p className="text-[13px] text-[#8E8E93] mt-1.5 leading-relaxed max-w-[480px]">{path.summary}</p>
          )}
        </div>
        <Link href="/dashboard/profile"
          className="flex-shrink-0 text-[13px] text-[#007AFF] hover:underline">
          Profil bearbeiten
        </Link>
      </div>

      {/* No avatar yet — prompt but still show ladders below */}
      {!path && (
        <div className="rounded-2xl border border-dashed border-[#C7C7CC] p-8 text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-[#F2F2F7] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-black">Noch kein KI-Karrierepfad generiert</p>
          <p className="text-[13px] text-[#8E8E93] mt-1 max-w-[320px] mx-auto">
            Generiere deinen Career Avatar um einen personalisierten Pfad zu erhalten. Die Karriereleitern unten zeigen dir schon jetzt deine Optionen.
          </p>
          <Link href="/dashboard/profile"
            className="mt-4 inline-flex items-center gap-1.5 px-5 h-10 rounded-2xl text-white text-[13px] font-semibold"
            style={{ backgroundColor: '#007AFF' }}>
            Avatar generieren
          </Link>
        </div>
      )}

      {/* AI-generated career path timeline */}
      {path && path.steps.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-bold text-black">Dein KI-Karrierepfad</h2>
            <span className="text-[12px] text-[#8E8E93] bg-[#F2F2F7] px-2.5 py-1 rounded-full">
              KI-generiert
            </span>
          </div>
          <div className="relative mb-10">
            <div className="absolute left-0 top-5 bottom-5 w-px bg-[#E5E5EA]" style={{ left: '11px' }} />
            <div className="space-y-4">
              {path.steps.map(step => (
                <StepCard
                  key={step.position}
                  step={step}
                  gap={gapMap[step.position]}
                  demandMap={demandMap}
                  isCurrent={!!step.is_current}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Company career ladders */}
      {sortedLadders.length > 0 && (
        <div className="mt-2">
          <div className="mb-5">
            <h2 className="text-[22px] font-bold tracking-tight text-black">Karriereleitern</h2>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">
              Verfügbare Karrierepfade — grüne Skills hast du bereits, graue noch nicht
            </p>
          </div>
          <div className="space-y-4">
            {sortedLadders.map(ladder => (
              <LadderCard
                key={ladder.id}
                ladder={ladder}
                candidateSkills={candidateSkills}
                isRecommended={path?.base_ladder_id === ladder.id}
              />
            ))}
          </div>
        </div>
      )}

      {sortedLadders.length === 0 && !path && (
        <div className="rounded-2xl border border-dashed border-[#C7C7CC] p-8 text-center mt-4">
          <p className="text-[14px] text-[#8E8E93]">Noch keine Karriereleitern für dein Konto verfügbar.</p>
        </div>
      )}

      {/* Soft skill radar */}
      {hasRadar && (
        <div className="mt-10 rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-4">
            Soft Skill Radar
          </p>
          <SkillRadar selfRatings={selfRatings} aiRatings={aiRatings} />
          <div className="mt-4 space-y-1.5">
            {SOFT_SKILLS.map(skill => {
              const self = selfRatings[skill];
              const ai   = aiRatings[skill];
              if (!self && !ai) return null;
              return (
                <div key={skill} className="flex items-center gap-3 text-[12px]">
                  <span className="w-[160px] text-[#3C3C43]">{SOFT_SKILL_LABELS[skill]}</span>
                  {self && (
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 rounded-full bg-[#007AFF]" style={{ width: `${(self / 5) * 60}px` }} />
                      <span className="text-[#007AFF] w-5">{self}/5</span>
                    </div>
                  )}
                  {ai && (
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 rounded-full bg-[#5856D6]" style={{ width: `${(ai / 5) * 60}px` }} />
                      <span className="text-[#5856D6] w-5">{ai}/5</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#F2F2F7]">
            <div className="flex items-center gap-1.5 text-[12px] text-[#8E8E93]">
              <div className="w-3 h-1.5 rounded-full bg-[#007AFF]" />
              Selbsteinschätzung
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-[#8E8E93]">
              <div className="w-3 h-1.5 rounded-full bg-[#5856D6]" />
              KI-Analyse
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
