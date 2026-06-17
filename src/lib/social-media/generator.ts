import type { Demand } from '@/types/database';
import type { SocialPlatform } from '@/types/database';

const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'Festanstellung',
  freelance: 'Freelance',
  contractor: 'Contractor',
  internship: 'Praktikum',
};

function fmtBudget(demand: Demand): string | null {
  if (demand.budget_max) return `bis zu €${demand.budget_max.toLocaleString('de-DE')}`;
  if (demand.budget_min) return `ab €${demand.budget_min.toLocaleString('de-DE')}`;
  return null;
}

function fmtStart(demand: Demand): string | null {
  if (!demand.start_date) return null;
  return new Date(demand.start_date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function locationStr(demand: Demand): string {
  if (demand.location && demand.remote_allowed) return `${demand.location} · Remote möglich`;
  if (demand.location) return demand.location;
  if (demand.remote_allowed) return 'Remote';
  return 'Deutschland';
}

function skillHashtags(demand: Demand): string[] {
  return demand.skills
    .slice(0, 5)
    .map(s => '#' + s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
}

export function generateContent(
  platform: SocialPlatform,
  demand: Demand,
  trackingUrl: string,
): { caption: string; hashtags: string[] } {
  const contract = CONTRACT_LABELS[demand.contract_type] ?? demand.contract_type;
  const location = locationStr(demand);
  const budget = fmtBudget(demand);
  const start = fmtStart(demand);
  const skills = demand.skills.slice(0, 5).join(', ') || 'Fachkenntnisse';
  const skillTags = skillHashtags(demand);

  switch (platform) {
    case 'instagram':
      return {
        caption: [
          `🚀 Wir suchen: ${demand.title}`,
          ``,
          `📍 ${location}`,
          `💼 ${contract}`,
          budget ? `💰 ${budget}` : '',
          start ? `📅 Start: ${start}` : '',
          ``,
          `✅ Skills: ${skills}`,
          ``,
          `Scan den QR-Code oder bewerbe dich direkt über den Link in der Bio!`,
        ].filter(l => l !== null && !(l === '' && false)).join('\n'),
        hashtags: ['#hiring', '#jobs', '#karriere', '#jobsuche', '#newjob', ...skillTags, '#workforcex'],
      };

    case 'linkedin':
      return {
        caption: [
          `Wir suchen eine/n ${demand.title} (${contract}) für unser Team.`,
          ``,
          `📍 Standort: ${location}`,
          budget ? `💰 Budget: ${budget}` : '',
          start ? `📅 Starttermin: ${start}` : '',
          ``,
          `Gesucht werden Kenntnisse in: ${skills}`,
          ``,
          demand.description
            ? demand.description.split('. ').slice(0, 2).join('. ') + '.'
            : `Diese Position bietet die Möglichkeit, in einem dynamischen Umfeld mit modernster Technologie zu arbeiten.`,
          ``,
          `Jetzt bewerben: ${trackingUrl}`,
        ].filter(l => l !== null).join('\n'),
        hashtags: ['#hiring', '#openposition', '#karriere', '#jobopportunity', ...skillTags],
      };

    case 'facebook':
      return {
        caption: [
          `📢 Neue Stelle: ${demand.title}`,
          ``,
          demand.description
            ? demand.description.split('. ').slice(0, 2).join('. ') + '.'
            : `Wir suchen eine engagierte Fachkraft für unser wachsendes Team.`,
          ``,
          `📍 ${location} · 💼 ${contract}`,
          budget ? `💰 ${budget}` : '',
          start ? `📅 Start: ${start}` : '',
          ``,
          `Skills: ${skills}`,
          ``,
          `👉 Hier bewerben: ${trackingUrl}`,
        ].filter(l => l !== null).join('\n'),
        hashtags: ['#hiring', '#jobs', '#karriere', '#stellenangebot', ...skillTags],
      };

    case 'tiktok':
      return {
        caption: [
          `${demand.title} gesucht! 🔥`,
          `📍 ${location} · ${contract}`,
          budget ? `💰 ${budget}` : '',
          `✨ Scan den QR-Code und bewirb dich jetzt!`,
        ].filter(Boolean).join('\n'),
        hashtags: ['#hiringnow', '#jobsuche', '#karriere', '#neujob', '#worklife', ...skillTags.slice(0, 3)],
      };

    default:
      return {
        caption: `${demand.title} | ${location} | ${contract}\n\n${trackingUrl}`,
        hashtags: ['#hiring', ...skillTags],
      };
  }
}
