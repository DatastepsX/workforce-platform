'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CareerLadder, CareerLadderStep } from '@/types/database';
import { updateCareerLadder, replaceCareerLadderSteps, type StepInput } from '@/lib/actions/career-ladders';

const INPUT = 'w-full h-10 px-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[14px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all';
const LABEL = 'block text-[12px] font-medium text-[#3C3C43] mb-1';

interface Props {
  ladder: CareerLadder;
  steps: CareerLadderStep[];
}

export function LadderEditForm({ ladder, steps: initialSteps }: Props) {
  const router = useRouter();
  const [steps, setSteps] = useState<StepInput[]>(
    initialSteps
      .sort((a, b) => a.position - b.position)
      .map(s => ({
        position: s.position,
        title: s.title,
        required_skills: s.required_skills,
        description: s.description ?? '',
      }))
  );
  const [saving, setSaving] = useState(false);

  function addStep() {
    setSteps(prev => [
      ...prev,
      { position: prev.length + 1, title: '', required_skills: [], description: '' },
    ]);
  }

  function removeStep(i: number) {
    setSteps(prev =>
      prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, position: idx + 1 }))
    );
  }

  function updateStep(i: number, field: keyof StepInput, value: string | string[] | number) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  async function handleSaveSteps() {
    setSaving(true);
    try {
      const res = await replaceCareerLadderSteps(ladder.id, steps);
      if ('error' in res) { alert(res.error); setSaving(false); return; }
      router.push('/dashboard/career-ladders');
    } catch (e) {
      alert(String(e));
      setSaving(false);
    }
  }

  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="flex items-center gap-3 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/career-ladders" className="hover:text-[#007AFF] transition-colors">Career Ladders</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        <span className="text-black font-medium">{ladder.name}</span>
      </div>

      <h1 className="text-[28px] font-bold tracking-tight text-black mb-6">{ladder.name}</h1>

      {/* Ladder meta */}
      <form action={updateCareerLadder} className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-6 space-y-3">
        <input type="hidden" name="id" value={ladder.id} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Name *</label>
            <input type="text" name="name" required defaultValue={ladder.name} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Branche</label>
            <input type="text" name="industry" defaultValue={ladder.industry ?? ''} className={INPUT} />
          </div>
        </div>
        <div>
          <label className={LABEL}>Beschreibung</label>
          <input type="text" name="description" defaultValue={ladder.description ?? ''} className={INPUT} />
        </div>
        <button type="submit"
          className="h-9 px-5 rounded-xl text-white text-[13px] font-semibold hover:opacity-90"
          style={{ backgroundColor: '#007AFF' }}>
          Metadaten speichern
        </button>
      </form>

      {/* Steps editor */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-black">Karrierestufen</h2>
        <button type="button" onClick={addStep}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[#E5E5EA] text-[12px] font-medium text-[#007AFF] hover:bg-[#007AFF]/6 transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Stufe hinzufügen
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {steps.map((step, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full text-[11px] font-bold text-white flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#007AFF' }}>{i + 1}</span>
              <span className="text-[12px] font-semibold text-[#3C3C43]">Stufe {step.position}</span>
              <button type="button" onClick={() => removeStep(i)}
                className="ml-auto text-[11px] text-[#FF3B30] hover:opacity-70 transition-opacity">
                Entfernen
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <label className={LABEL}>Titel *</label>
                <input type="text" value={step.title}
                  onChange={e => updateStep(i, 'title', e.target.value)}
                  placeholder="z.B. Junior Software Engineer"
                  className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Beschreibung</label>
                <input type="text" value={step.description}
                  onChange={e => updateStep(i, 'description', e.target.value)}
                  placeholder="Was diese Stufe bedeutet…"
                  className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Benötigte Skills (kommagetrennt)</label>
                <input type="text"
                  value={step.required_skills.join(', ')}
                  onChange={e => updateStep(i, 'required_skills',
                    e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  )}
                  placeholder="TypeScript, React, Node.js"
                  className={INPUT} />
              </div>
            </div>
          </div>
        ))}

        {steps.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#C7C7CC] p-6 text-center text-[13px] text-[#8E8E93]">
            Noch keine Stufen &mdash; klicke auf &quot;+ Stufe hinzufügen&quot;
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={handleSaveSteps} disabled={saving}
          className="h-11 px-6 rounded-2xl text-white text-[14px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: '#007AFF' }}>
          {saving ? 'Speichern…' : 'Stufen speichern'}
        </button>
        <Link href="/dashboard/career-ladders"
          className="h-11 px-6 rounded-2xl border border-[#E5E5EA] text-[14px] font-medium text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors flex items-center">
          Abbrechen
        </Link>
      </div>
    </div>
  );
}
