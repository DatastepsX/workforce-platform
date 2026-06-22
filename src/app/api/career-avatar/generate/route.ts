import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SOFT_SKILLS } from '@/types/database';
import { trackApiCall } from '@/lib/api-tracker';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface LadderStep { position: number; title: string; required_skills: string[] }
interface LadderRow { name: string; id: string; industry: string | null; career_ladder_steps: LadderStep[] }
interface PathStepRaw { position: number; title: string; description: string; required_skills: string[]; rationale: string; is_current: boolean; estimated_duration_months: number; matching_demand_ids: string[] }
interface PathDataRaw { title?: string; summary?: string; base_ladder_name?: string; steps?: PathStepRaw[] }
interface GapItemRaw { step_position: number; missing_skills: string[]; recommendations: unknown[] }

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminDb = createAdminClient();

  // Guard: check role is candidate
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'candidate') {
    return NextResponse.json({ error: 'Only candidates can generate an avatar' }, { status: 403 });
  }

  // Set status → generating
  await adminDb.from('candidate_profiles')
    .update({ avatar_status: 'generating' }).eq('id', user.id);

  try {
    // Fetch full candidate profile
    const { data: cp } = await adminDb.from('candidate_profiles').select('*').eq('id', user.id).single();
    if (!cp) throw new Error('Candidate profile not found');

    // Fetch existing self-ratings
    const { data: selfRatings } = await adminDb
      .from('soft_skill_ratings').select('skill, self_rating').eq('candidate_profile_id', user.id);
    const selfRatingMap = Object.fromEntries((selfRatings ?? []).map(r => [r.skill, r.self_rating]));

    // Fetch all career ladders with steps
    const { data: ladders } = await adminDb
      .from('career_ladders').select('*, career_ladder_steps(*)').order('name');

    // Fetch open demands for cross-referencing
    const { data: openDemands } = await adminDb
      .from('demands').select('id, title, skills').in('status', ['sourcing','screening','interview']).limit(40);

    // ── Step 1: Parse CV (if available) ──────────────────────────────────────
    let cvData: {
      key_skills: string[];
      experience_summary: string;
      education: string;
      estimated_soft_skills: Record<string, number>;
    } | null = null;

    if (cp.cv_path) {
      try {
        const { data: signedData } = await adminDb.storage.from('cvs').createSignedUrl(cp.cv_path, 120);
        if (signedData?.signedUrl) {
          const pdfRes = await fetch(signedData.signedUrl);
          if (pdfRes.ok) {
            const pdfBase64 = Buffer.from(await pdfRes.arrayBuffer()).toString('base64');

            const cvRes = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 1200,
              messages: [{
                role: 'user',
                content: [
                  { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
                  { type: 'text', text: `Analysiere diesen Lebenslauf. Antworte ausschließlich mit JSON (keine Backticks):
{
  "key_skills": ["skill1", "skill2"],
  "experience_summary": "2-3 Sätze über Berufserfahrung",
  "education": "Ausbildung in einem Satz",
  "estimated_soft_skills": {
    "communication":1,"leadership":1,"teamwork":1,"analytical_thinking":1,
    "problem_solving":1,"creativity":1,"project_management":1,"negotiation":1,
    "customer_orientation":1,"data_analytics":1,"presentation":1,"organization":1
  }
}
Schätze jeden Soft-Skill 1–5 basierend auf Tätigkeitsbeschreibungen.` },
                ],
              }],
            });

            trackApiCall({ purpose: 'Career Avatar — CV Parse', model: 'claude-sonnet-4-6', inputTokens: cvRes.usage.input_tokens, outputTokens: cvRes.usage.output_tokens, context: `Candidate: ${user.id}` });
            const cvText = cvRes.content[0].type === 'text' ? cvRes.content[0].text : '';
            cvData = JSON.parse(stripJsonFences(cvText));
          }
        }
      } catch (e) {
        console.error('[CareerAvatar] CV parsing non-fatal error:', e);
      }
    }

    // ── Step 2: Save AI soft skill ratings ───────────────────────────────────
    if (cvData?.estimated_soft_skills) {
      const upserts = SOFT_SKILLS
        .filter(skill => cvData!.estimated_soft_skills[skill] != null)
        .map(skill => ({
          candidate_profile_id: user.id,
          skill,
          self_rating:  selfRatingMap[skill] ?? null,
          ai_rating:    Math.round(cvData!.estimated_soft_skills[skill]),
          updated_at:   new Date().toISOString(),
        }));
      if (upserts.length > 0) {
        await adminDb.from('soft_skill_ratings').upsert(upserts, { onConflict: 'candidate_profile_id,skill' });
      }
    }

    // ── Step 3: Generate avatar summary ──────────────────────────────────────
    const profileCtx = [
      cp.full_name        && `Name: ${cp.full_name}`,
      cp.headline         && `Position: ${cp.headline}`,
      cp.years_experience && `Erfahrung: ${cp.years_experience} Jahre`,
      cp.seniority_level  && `Level: ${cp.seniority_level}`,
      cp.skills?.length   && `Technische Skills: ${cp.skills.join(', ')}`,
      cp.career_goals     && `Karriereziele: ${cp.career_goals}`,
      cp.strengths        && `Stärken: ${cp.strengths}`,
      cp.weaknesses       && `Entwicklungsbereiche: ${cp.weaknesses}`,
      cp.motivation       && `Motivation: ${cp.motivation}`,
      cp.learning_willingness && `Lernbereitschaft: ${cp.learning_willingness}/5`,
      cp.preferred_positions?.length && `Bevorzugte Positionen: ${cp.preferred_positions.join(', ')}`,
      cvData?.experience_summary && `CV-Zusammenfassung: ${cvData.experience_summary}`,
      cvData?.education          && `Ausbildung: ${cvData.education}`,
    ].filter(Boolean).join('\n');

    const summaryRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: 'Du bist ein professioneller Karriereberater. Schreibe prägnante, authentische Career Avatar Texte auf Deutsch.',
      messages: [{
        role: 'user',
        content: `Erstelle einen Career Avatar Text (2–3 Absätze, max. 220 Wörter) für diese Person.
Schreibe in der dritten Person, hebe Stärken hervor, kommuniziere Karriereambitionen klar.
Keine Überschriften, kein Markdown.

Profil:
${profileCtx}`,
      }],
    });

    trackApiCall({ purpose: 'Career Avatar — Summary', model: 'claude-sonnet-4-6', inputTokens: summaryRes.usage.input_tokens, outputTokens: summaryRes.usage.output_tokens, context: `Candidate: ${cp.full_name ?? user.id}` });
    const avatarSummary = summaryRes.content[0].type === 'text' ? summaryRes.content[0].text.trim() : '';

    await adminDb.from('candidate_profiles').update({
      avatar_summary: avatarSummary,
      avatar_generated_at: new Date().toISOString(),
    }).eq('id', user.id);

    // ── Step 4: Generate career path ─────────────────────────────────────────
    const laddersCtx = ((ladders ?? []) as LadderRow[])
      .map(l => {
        const steps = ((l.career_ladder_steps ?? []) as LadderStep[])
          .sort((a, b) => a.position - b.position)
          .map(s => `  ${s.position}. ${s.title} [${s.required_skills?.join(', ')}]`)
          .join('\n');
        return `Leiter "${l.name}" (${l.industry}):\n${steps}`;
      })
      .join('\n\n') || 'Keine Leitern vorhanden — erstelle einen individuellen Pfad.';

    const demandsCtx = (openDemands ?? []).slice(0, 25)
      .map(d => `ID:${d.id} | ${d.title} | Skills:${(d.skills ?? []).join(',')}`)
      .join('\n') || 'Keine offenen Stellen.';

    const pathRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'Du bist ein strategischer Karriereberater. Erstelle personalisierte Karrierepfade auf Deutsch. Antworte nur mit JSON.',
      messages: [{
        role: 'user',
        content: `Erstelle einen personalisierten Karrierepfad.

PROFIL:
${profileCtx}

KARRIERELEITERN:
${laddersCtx}

OFFENE STELLEN (zur Vernetzung):
${demandsCtx}

Antwort als JSON (keine Backticks):
{
  "title": "Karrierepfad-Titel",
  "summary": "2–3 Sätze Beschreibung",
  "base_ladder_name": "Name der gewählten Leiter oder null",
  "steps": [
    {
      "position": 1,
      "title": "Positionstitel",
      "description": "Was diese Stufe bedeutet und erwartet wird",
      "required_skills": ["skill1", "skill2"],
      "rationale": "Warum diese Stufe für die Person sinnvoll ist",
      "is_current": true,
      "estimated_duration_months": 18,
      "matching_demand_ids": ["demand-uuid-1"]
    }
  ]
}

Erstelle 4–6 Stufen. Markiere aktuelle Position mit is_current:true.
Verknüpfe nur echte Demand-IDs aus der Liste oben in matching_demand_ids.`,
      }],
    });

    trackApiCall({ purpose: 'Career Avatar — Career Path', model: 'claude-sonnet-4-6', inputTokens: pathRes.usage.input_tokens, outputTokens: pathRes.usage.output_tokens, context: `Candidate: ${cp.full_name ?? user.id}` });
    const pathText = pathRes.content[0].type === 'text' ? pathRes.content[0].text : '{}';
    let pathData: PathDataRaw = {};
    try { pathData = JSON.parse(stripJsonFences(pathText)) as PathDataRaw; } catch { /* use empty */ }

    const matchingLadder = ((ladders ?? []) as LadderRow[]).find(l => l.name === pathData.base_ladder_name);

    await adminDb.from('candidate_career_paths').update({ is_current: false })
      .eq('candidate_profile_id', user.id);

    const { data: newPath } = await adminDb.from('candidate_career_paths').insert({
      candidate_profile_id: user.id,
      base_ladder_id: matchingLadder?.id ?? null,
      path_type: matchingLadder ? 'ladder_based' : 'ai_custom',
      title:    pathData.title ?? 'Dein Karrierepfad',
      summary:  pathData.summary ?? '',
      steps:    pathData.steps ?? [],
      is_current: true,
    }).select().single();

    // ── Step 5: Generate skill gaps ───────────────────────────────────────────
    if (newPath && Array.isArray(pathData.steps) && pathData.steps.length > 0) {
      const currentSkills = [...(cp.skills ?? []), ...(cvData?.key_skills ?? [])];

      const gapRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: 'Du bist ein Skill-Gap-Analyst. Antworte nur mit JSON.',
        messages: [{
          role: 'user',
          content: `Analysiere Skill-Gaps für jeden Karriereschritt.

AKTUELLE SKILLS:
${currentSkills.join(', ') || 'Keine Skills angegeben'}

SCHRITTE:
${(pathData.steps as PathStepRaw[]).map(s => `Stufe ${s.position} "${s.title}": [${s.required_skills?.join(', ')}]`).join('\n')}

Antwort als JSON-Array (keine Backticks):
[
  {
    "step_position": 1,
    "missing_skills": ["skill1"],
    "recommendations": [
      { "type": "course", "title": "Kursname", "description": "Was man lernt" }
    ]
  }
]

Erlaubte types: "course","certification","project","mentoring".
2–3 Empfehlungen pro Stufe. Für is_current-Stufen: 0–1 fehlende Skills erwartet.`,
        }],
      });

      trackApiCall({ purpose: 'Career Avatar — Skill Gaps', model: 'claude-sonnet-4-6', inputTokens: gapRes.usage.input_tokens, outputTokens: gapRes.usage.output_tokens, context: `Candidate: ${cp.full_name ?? user.id}` });
      const gapText = gapRes.content[0].type === 'text' ? gapRes.content[0].text : '[]';
      let gapData: GapItemRaw[] = [];
      try { gapData = JSON.parse(stripJsonFences(gapText)) as GapItemRaw[]; } catch { /* skip */ }

      if (gapData.length > 0) {
        await adminDb.from('career_skill_gaps').insert(
          gapData.map(g => ({
            career_path_id:  newPath.id,
            step_position:   g.step_position,
            missing_skills:  g.missing_skills ?? [],
            recommendations: g.recommendations ?? [],
          }))
        );
      }
    }

    // Mark ready
    await adminDb.from('candidate_profiles')
      .update({ avatar_status: 'ready' }).eq('id', user.id);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[CareerAvatar] Generation failed:', err);
    await createAdminClient().from('candidate_profiles')
      .update({ avatar_status: 'error' }).eq('id', user.id);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
