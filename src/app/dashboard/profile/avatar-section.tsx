'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CandidateProfile, SoftSkill, SoftSkillRating } from '@/types/database';
import { SOFT_SKILLS, SOFT_SKILL_LABELS } from '@/types/database';
import { SkillRadar } from './skill-radar';
import {
  saveAvatarSelfAssessment,
  saveSoftSkillRatings,
  toggleAvatarVisibility,
} from '@/lib/actions/career-avatar';

const TEXTAREA = 'w-full px-4 py-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 resize-none transition-all';
const LABEL   = 'block text-[13px] font-medium text-[#3C3C43] mb-1.5';

function TagInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string[] }) {
  const [tags, setTags] = useState<string[]>(defaultValue ?? []);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const val = (e as CustomEvent<string>).detail;
      setTags(val.split(',').map(s => s.trim()).filter(Boolean));
    };
    el.addEventListener('fill-tags', handler);
    return () => el.removeEventListener('fill-tags', handler);
  }, []);

  function add(v: string) {
    const t = v.trim();
    if (t && !tags.includes(t)) setTags(p => [...p, t]);
    setInput('');
  }

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input type="hidden" name={name} value={tags.join(',')} />
      <div className="min-h-[44px] px-3 py-2 rounded-[10px] border border-[#E5E5EA] bg-white flex flex-wrap gap-1.5 focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 transition-all">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 text-[12px] bg-[#007AFF]/10 text-[#007AFF] px-2.5 py-0.5 rounded-full font-medium">
            {t}
            <button type="button" onClick={() => setTags(p => p.filter(x => x !== t))} className="hover:opacity-70">×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          data-tag-input={name}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); } else if (e.key === 'Backspace' && !input && tags.length) setTags(p => p.slice(0, -1)); }}
          onBlur={() => add(input)}
          placeholder={tags.length === 0 ? 'Eingeben & Enter drücken…' : ''}
          className="flex-1 min-w-[120px] outline-none text-[15px] placeholder-[#C7C7CC] bg-transparent"
        />
      </div>
    </div>
  );
}

interface Props {
  profile: CandidateProfile;
  softSkillRatings: SoftSkillRating[];
}

export function AvatarSection({ profile, softSkillRatings }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'self' | 'ai'>('self');
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Soft skill ratings state
  const [skillRatings, setSkillRatings] = useState<Partial<Record<SoftSkill, number>>>(() =>
    Object.fromEntries(softSkillRatings.map(r => [r.skill, r.self_rating ?? 0])) as Partial<Record<SoftSkill, number>>
  );

  const aiRatings: Partial<Record<SoftSkill, number>> = Object.fromEntries(
    softSkillRatings.filter(r => r.ai_rating != null).map(r => [r.skill, r.ai_rating!])
  );

  const isReady = profile.avatar_status === 'ready';

  async function handleSaveSelf(formData: FormData) {
    startTransition(async () => {
      const res = await saveAvatarSelfAssessment(formData);
      if ('error' in res) { setSaveMsg('Fehler: ' + res.error); return; }
      const skillRes = await saveSoftSkillRatings(skillRatings as Record<SoftSkill, number | null>);
      if ('error' in skillRes) { setSaveMsg('Fehler beim Speichern der Skills: ' + skillRes.error); return; }
      setSaveMsg('Gespeichert ✓');
      setTimeout(() => setSaveMsg(null), 2500);
    });
  }

  async function handleToggleVisibility() {
    startTransition(async () => {
      await toggleAvatarVisibility(!profile.avatar_visible_to_recruiters);
      router.refresh();
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/career-avatar/generate', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        setGenError(body.error ?? 'Unbekannter Fehler');
      } else {
        router.refresh();
        setActiveTab('ai');
      }
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mt-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-black">Career Avatar</h2>
          <p className="text-[13px] text-[#8E8E93] mt-0.5">
            KI-gestütztes Kompetenzprofil & Karriereplanung
          </p>
        </div>
        {/* Visibility toggle */}
        <button
          type="button"
          onClick={handleToggleVisibility}
          disabled={isPending}
          title={profile.avatar_visible_to_recruiters ? 'Für Recruiter sichtbar' : 'Für Recruiter nicht sichtbar'}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors"
          style={profile.avatar_visible_to_recruiters
            ? { borderColor: '#34C759', backgroundColor: '#34C75910', color: '#34C759' }
            : { borderColor: '#E5E5EA', backgroundColor: 'white', color: '#8E8E93' }
          }
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {profile.avatar_visible_to_recruiters
              ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
              : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
            }
          </svg>
          {profile.avatar_visible_to_recruiters ? 'Sichtbar für Recruiter' : 'Nicht sichtbar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-5 bg-[#F2F2F7] rounded-xl p-1 w-fit">
        {([['self', 'Selbsteinschätzung'], ['ai', 'KI-Profil']] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all"
            style={activeTab === tab
              ? { backgroundColor: 'white', color: '#007AFF', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
              : { color: '#8E8E93' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Selbsteinschätzung ──────────────────────────────────────── */}
      {activeTab === 'self' && (
        <form action={handleSaveSelf} className="space-y-5">
          {/* Career goals */}
          <div>
            <label className={LABEL}>Karriereziele</label>
            <textarea name="career_goals" rows={3} defaultValue={profile.career_goals ?? ''}
              placeholder="Was möchtest du in den nächsten 3–5 Jahren erreichen?"
              className={TEXTAREA} />
          </div>

          {/* Preferred positions */}
          <TagInput name="preferred_positions" label="Bevorzugte Positionen" defaultValue={profile.preferred_positions ?? []} />

          {/* Strengths + Weaknesses */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Stärken</label>
              <textarea name="strengths" rows={3} defaultValue={profile.strengths ?? ''}
                placeholder="Deine fachlichen und persönlichen Stärken…"
                className={TEXTAREA} />
            </div>
            <div>
              <label className={LABEL}>Entwicklungsbereiche</label>
              <textarea name="weaknesses" rows={3} defaultValue={profile.weaknesses ?? ''}
                placeholder="Bereiche, in denen du wachsen möchtest…"
                className={TEXTAREA} />
            </div>
          </div>

          {/* Motivation */}
          <div>
            <label className={LABEL}>Motivation</label>
            <textarea name="motivation" rows={2} defaultValue={profile.motivation ?? ''}
              placeholder="Was treibt dich an? Was macht dir Freude bei der Arbeit?"
              className={TEXTAREA} />
          </div>

          {/* Learning willingness */}
          <div>
            <label className={LABEL}>
              Lernbereitschaft&nbsp;
              <span className="text-[#8E8E93] font-normal">
                {profile.learning_willingness ? `${profile.learning_willingness}/5` : '–'}
              </span>
            </label>
            <input type="range" name="learning_willingness" min={1} max={5} step={1}
              defaultValue={profile.learning_willingness ?? 3}
              className="w-full accent-[#007AFF]" />
            <div className="flex justify-between text-[11px] text-[#8E8E93] mt-0.5">
              <span>Wenig</span><span>Mittel</span><span>Hoch</span>
            </div>
          </div>

          {/* Soft skill sliders */}
          <div className="rounded-2xl border border-[#E5E5EA] p-5 bg-white">
            <p className="text-[13px] font-semibold text-[#3C3C43] mb-4">
              Soft Skills — Selbsteinschätzung
            </p>
            <div className="space-y-3">
              {SOFT_SKILLS.map(skill => (
                <div key={skill} className="flex items-center gap-3">
                  <label htmlFor={`soft_skill_${skill}`} className="text-[12px] text-[#3C3C43] min-w-[150px]">{SOFT_SKILL_LABELS[skill]}</label>
                  <input
                    id={`soft_skill_${skill}`}
                    name={`soft_skill_${skill}`}
                    type="range" min={0} max={5} step={1}
                    value={skillRatings[skill] ?? 0}
                    onChange={e => setSkillRatings(p => ({ ...p, [skill]: Number(e.target.value) }))}
                    className="flex-1 accent-[#007AFF]"
                  />
                  <span className="text-[12px] text-[#8E8E93] w-6 text-right">
                    {skillRatings[skill] ? `${skillRatings[skill]}/5` : '–'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={isPending}
              className="px-6 h-11 rounded-2xl text-white text-[14px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#007AFF' }}>
              {isPending ? 'Speichern…' : 'Speichern'}
            </button>
            {saveMsg && (
              <span className="text-[13px]" style={{ color: saveMsg.startsWith('F') ? '#FF3B30' : '#34C759' }}>
                {saveMsg}
              </span>
            )}
          </div>
        </form>
      )}

      {/* ── Tab: KI-Profil ───────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="space-y-5">
          {/* Generate / Re-generate button */}
          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-black">
                  {isReady ? 'Avatar aktualisieren' : 'Career Avatar generieren'}
                </p>
                <p className="text-[12px] text-[#8E8E93] mt-0.5">
                  {isReady
                    ? `Zuletzt generiert: ${new Date(profile.avatar_generated_at!).toLocaleDateString('de-DE')}`
                    : 'KI analysiert dein CV und erstellt ein personalisiertes Profil (ca. 30–60 Sek.)'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="flex-shrink-0 flex items-center gap-2 px-4 h-10 rounded-xl text-white text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#007AFF' }}
              >
                {generating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Generierung läuft…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    {isReady ? 'Neu generieren' : 'Avatar generieren'}
                  </>
                )}
              </button>
            </div>

            {generating && (
              <div className="mt-4 space-y-2">
                {['CV wird analysiert…', 'Avatar-Zusammenfassung wird erstellt…', 'Karrierepfad wird generiert…', 'Skill-Gaps werden analysiert…'].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-[#8E8E93]">
                    <svg className="w-3.5 h-3.5 animate-spin text-[#007AFF]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    {step}
                  </div>
                ))}
              </div>
            )}

            {genError && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-[#FF3B30]/8 border border-[#FF3B30]/20 text-[12px] text-[#FF3B30]">
                {genError}
              </div>
            )}
          </div>

          {/* Avatar summary */}
          {isReady && profile.avatar_summary && (
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-5">
              <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">
                Dein Career Avatar
              </p>
              <p className="text-[14px] text-[#3C3C43] leading-relaxed whitespace-pre-wrap">
                {profile.avatar_summary}
              </p>
            </div>
          )}

          {/* Skill radar */}
          {isReady && (Object.keys(aiRatings).length > 0 || Object.values(skillRatings).some(v => v)) && (
            <div className="rounded-2xl border border-[#E5E5EA] bg-white p-5">
              <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-4">
                Soft Skill Radar
              </p>
              <SkillRadar selfRatings={skillRatings} aiRatings={aiRatings} />
            </div>
          )}

          {/* Career Navigator CTA */}
          {isReady && (
            <a
              href="/dashboard/career-navigator"
              className="flex items-center justify-between p-5 rounded-2xl border border-[#007AFF]/30 bg-[#007AFF]/5 hover:bg-[#007AFF]/8 transition-colors group"
            >
              <div>
                <p className="text-[14px] font-semibold text-[#007AFF]">Career Navigator öffnen</p>
                <p className="text-[12px] text-[#8E8E93] mt-0.5">Dein persönlicher Karrierepfad mit Skill-Gaps und offenen Stellen</p>
              </div>
              <svg className="w-5 h-5 text-[#007AFF] group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </a>
          )}

          {!isReady && profile.avatar_status === 'none' && (
            <div className="rounded-2xl border border-dashed border-[#C7C7CC] p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-black">Noch kein Avatar erstellt</p>
              <p className="text-[12px] text-[#8E8E93] mt-1">Fülle die Selbsteinschätzung aus und klicke auf &quot;Avatar generieren&quot;.</p>
            </div>
          )}

          {profile.avatar_status === 'error' && (
            <div className="rounded-2xl border border-[#FF3B30]/20 bg-[#FF3B30]/5 p-4 text-[13px] text-[#FF3B30]">
              Die letzte Generierung ist fehlgeschlagen. Bitte erneut versuchen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
