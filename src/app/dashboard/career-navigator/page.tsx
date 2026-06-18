import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type {
  CandidateCareerPath, CareerPathStep, CareerSkillGap,
  CareerRecommendation, SoftSkillRating,
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
      {/* Timeline dot */}
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
        {/* Step header */}
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

        {/* Required skills */}
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

        {/* Open demands matching this step */}
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

        {/* Skill gaps */}
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

        {/* Rationale */}
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

export default async function CareerNavigatorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileData?.role !== 'candidate') redirect('/dashboard');

  const [, { data: pathData }, { data: ratingsData }] = await Promise.all([
    supabase.from('candidate_profiles').select('id').eq('id', user.id).single(),
    supabase.from('candidate_career_paths')
      .select('*')
      .eq('candidate_profile_id', user.id)
      .eq('is_current', true)
      .single(),
    supabase.from('soft_skill_ratings').select('*').eq('candidate_profile_id', user.id),
  ]);

  const path = pathData as CandidateCareerPath | null;
  const ratings = (ratingsData ?? []) as SoftSkillRating[];

  const selfRatings = Object.fromEntries(ratings.filter(r => r.self_rating != null).map(r => [r.skill, r.self_rating!]));
  const aiRatings   = Object.fromEntries(ratings.filter(r => r.ai_rating  != null).map(r => [r.skill, r.ai_rating!]));

  // Fetch skill gaps and demand data for the path
  let gapMap: Record<number, CareerSkillGap> = {};
  let demandMap: Record<string, { title: string }> = {};

  if (path) {
    const { data: gaps } = await supabase
      .from('career_skill_gaps').select('*').eq('career_path_id', path.id);
    gapMap = Object.fromEntries((gaps ?? []).map(g => [g.step_position, g as CareerSkillGap]));

    // Collect all demand IDs referenced in steps
    const demandIds = path.steps.flatMap(s => s.matching_demand_ids ?? []).filter(Boolean);
    if (demandIds.length > 0) {
      const { data: demands } = await supabase
        .from('demands').select('id, title').in('id', demandIds);
      demandMap = Object.fromEntries((demands ?? []).map(d => [d.id, { title: d.title }]));
    }
  }

  const hasRadar = Object.keys(selfRatings).length > 0 || Object.keys(aiRatings).length > 0;

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

      {/* No avatar yet */}
      {!path && (
        <div className="rounded-2xl border border-dashed border-[#C7C7CC] p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F2F2F7] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-black">Kein Karrierepfad generiert</p>
          <p className="text-[13px] text-[#8E8E93] mt-1">
            Generiere deinen Career Avatar im Profil, um den Navigator zu aktivieren.
          </p>
          <Link href="/dashboard/profile"
            className="mt-4 inline-flex items-center gap-1.5 px-5 h-10 rounded-2xl text-white text-[13px] font-semibold"
            style={{ backgroundColor: '#007AFF' }}>
            Zum Profil
          </Link>
        </div>
      )}

      {/* Career path timeline */}
      {path && path.steps.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
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
        </div>
      )}
    </div>
  );
}
