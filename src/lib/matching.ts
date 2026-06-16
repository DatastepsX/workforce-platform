import type { CandidateProfile, Demand } from '@/types/database';

export interface MatchResult {
  score: number;         // 0–100
  skillScore: number;    // points from skills (max 70 or 100)
  rateScore: number;     // points from rate (max 30), 0 if no rate data
  matchedSkills: string[];
  missingSkills: string[];
  extraSkills: string[];
  hasRateData: boolean;
  rateNote: string | null;
}

export function computeMatch(candidate: CandidateProfile, demand: Demand): MatchResult {
  const demandSkills = demand.skills ?? [];
  const candidateSkills = candidate.skills ?? [];
  const candLower = candidateSkills.map(s => s.toLowerCase());

  const matchedSkills = demandSkills.filter(s => candLower.includes(s.toLowerCase()));
  const missingSkills = demandSkills.filter(s => !candLower.includes(s.toLowerCase()));
  const demLower = demandSkills.map(s => s.toLowerCase());
  const extraSkills = candidateSkills.filter(s => !demLower.includes(s.toLowerCase()));

  const hasRateData =
    (candidate.hourly_rate_min != null || candidate.hourly_rate_max != null) &&
    (demand.budget_min != null || demand.budget_max != null);

  const skillWeight = hasRateData ? 70 : 100;
  const rawSkill =
    demandSkills.length > 0
      ? (matchedSkills.length / demandSkills.length) * skillWeight
      : skillWeight;
  const skillScore = Math.round(rawSkill);

  let rateScore = 0;
  let rateNote: string | null = null;

  if (hasRateData) {
    const candRate = candidate.hourly_rate_max ?? candidate.hourly_rate_min ?? 0;
    const budgetCeil = demand.budget_max ?? demand.budget_min ?? 0;
    const currency = candidate.currency ?? 'EUR';

    if (candRate <= budgetCeil) {
      rateScore = 30;
      rateNote = `Rate (${currency} ${candRate.toLocaleString()}) fits within the demand budget`;
    } else {
      const over = candRate - budgetCeil;
      const pct = Math.max(0, 1 - over / budgetCeil);
      rateScore = Math.round(pct * 15);
      rateNote = `Rate (${currency} ${candRate.toLocaleString()}) exceeds demand budget by ${over.toLocaleString()}`;
    }
  }

  return {
    score: Math.min(100, skillScore + rateScore),
    skillScore,
    rateScore,
    matchedSkills,
    missingSkills,
    extraSkills,
    hasRateData,
    rateNote,
  };
}

export function matchColor(score: number): string {
  if (score >= 80) return '#34C759';
  if (score >= 60) return '#FF9500';
  if (score >= 40) return '#FFCC00';
  return '#FF3B30';
}
