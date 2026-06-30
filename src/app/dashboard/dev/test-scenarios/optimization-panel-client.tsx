'use client';

import { useState } from 'react';
import type { OptimizationIdea } from '@/lib/workflow/scenarios';

const PRIORITY_COLORS = { high: '#FF3B30', medium: '#FF9500', low: '#34C759' } as const;
const CATEGORY_ICONS: Record<string, string> = {
  process: '⚙️', compliance: '📋', technology: '💡', efficiency: '⚡', quality: '✨',
};

interface IdeaState {
  comment: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  message: string;
  showComment: boolean;
  actualCost: number | null;
}

export function OptimizationPanelClient({
  ideas,
  tenantName,
}: {
  ideas: OptimizationIdea[];
  tenantName: string;
}) {
  const [states, setStates] = useState<IdeaState[]>(
    ideas.map(() => ({ comment: '', status: 'idle', message: '', showComment: false, actualCost: null })),
  );

  function update(i: number, patch: Partial<IdeaState>) {
    setStates(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function handleOptimise(i: number) {
    update(i, { status: 'loading', message: '' });
    try {
      const res = await fetch('/api/optimize-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: ideas[i],
          comment: states[i].comment,
          tenantName,
        }),
      });
      const json = await res.json();
      if (json.success) {
        update(i, { status: 'done', message: json.message ?? 'Requirement processed and emailed.', showComment: false, actualCost: json.cost ?? null });
      } else {
        update(i, { status: 'error', message: json.error ?? 'Unknown error' });
      }
    } catch (err) {
      update(i, { status: 'error', message: String(err) });
    }
  }

  return (
    <div className="mt-4 border-t border-[#F2F2F7] pt-4">
      <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">
        🤖 AI Process Optimisation Ideas
      </p>
      <div className="space-y-3">
        {ideas.map((idea, i) => {
          const s = states[i];
          return (
            <div key={i} className="rounded-xl p-3" style={{ backgroundColor: '#F2F2F7' }}>
              <div className="flex items-start gap-2">
                <span className="text-[13px]">{CATEGORY_ICONS[idea.category] ?? '💡'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-bold text-black">{idea.title}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: PRIORITY_COLORS[idea.priority] ?? '#8E8E93' }}
                    >
                      {idea.priority.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-semibold text-[#8E8E93] uppercase">{idea.category}</span>
                  </div>
                  <p className="text-[11px] text-[#3C3C43] mt-1">{idea.description}</p>
                  <p className="text-[10px] text-[#8E8E93] mt-1">💰 {idea.impact}</p>
                  <p className="text-[10px] text-[#007AFF] mt-1 italic">{idea.requirement}</p>

                  {/* Optimise controls */}
                  <div className="mt-2.5 space-y-2">
                    {s.showComment && s.status !== 'done' && (
                      <textarea
                        className="w-full rounded-lg px-2.5 py-2 text-[11px] bg-white border border-[#E5E5EA] focus:outline-none focus:border-[#007AFF] resize-none"
                        rows={2}
                        placeholder="Optional: add more context or constraints…"
                        value={s.comment}
                        onChange={e => update(i, { comment: e.target.value })}
                        disabled={s.status === 'loading'}
                      />
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {s.status !== 'done' && (
                        <>
                          {!s.showComment && (
                            <button
                              onClick={() => update(i, { showComment: true })}
                              className="text-[11px] text-[#8E8E93] hover:text-[#3C3C43] transition-colors"
                            >
                              + add comment
                            </button>
                          )}
                          <button
                            onClick={() => handleOptimise(i)}
                            disabled={s.status === 'loading'}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50 transition-colors"
                            style={{ backgroundColor: '#007AFF' }}
                          >
                            {s.status === 'loading' ? (
                              <>
                                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing…
                              </>
                            ) : (
                              '⚡ Optimise'
                            )}
                          </button>
                        </>
                      )}

                      {s.status !== 'done' && (
                        <span className="text-[9px] text-[#C7C7CC]">~$0.02</span>
                      )}

                      {s.status === 'done' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-[#34C759]">✓ {s.message}</span>
                          {s.actualCost !== null && (
                            <span className="text-[9px] text-[#8E8E93]">actual: ${s.actualCost.toFixed(4)}</span>
                          )}
                        </div>
                      )}
                      {s.status === 'error' && (
                        <span className="text-[11px] text-[#FF3B30]">⚠ {s.message}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
