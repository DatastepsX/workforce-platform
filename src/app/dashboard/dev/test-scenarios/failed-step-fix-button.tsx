'use client';

import { useState } from 'react';
import type { ExtendedScenarioStep } from '@/lib/workflow/scenarios';

interface Props {
  step: ExtendedScenarioStep;
  error?: string;
  tenantName: string;
}

export function FailedStepFixButton({ step, error, tenantName }: Props) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [actualCost, setActualCost] = useState<number | null>(null);

  async function handleFix() {
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/fix-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, error, comment, tenantName }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus('done');
        setMessage(json.message ?? 'Fix spec emailed.');
        setActualCost(json.cost ?? null);
        setShowComment(false);
      } else {
        setStatus('error');
        setMessage(json.error ?? 'Unknown error');
      }
    } catch (err) {
      setStatus('error');
      setMessage(String(err));
    }
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] font-semibold text-[#34C759]">✓ {message}</span>
        {actualCost !== null && (
          <span className="text-[9px] text-[#8E8E93]">actual cost: ${actualCost.toFixed(4)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      {showComment && (
        <textarea
          className="w-full rounded-lg px-2.5 py-2 text-[11px] bg-white border border-[#E5E5EA] focus:outline-none focus:border-[#FF3B30] resize-none"
          rows={2}
          placeholder="Optional: add context or hints for the fix…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          disabled={status === 'loading'}
        />
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {!showComment && (
          <button
            onClick={() => setShowComment(true)}
            className="text-[10px] text-[#8E8E93] hover:text-[#3C3C43] transition-colors"
          >
            + add context
          </button>
        )}
        <button
          onClick={handleFix}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#FF3B30' }}
        >
          {status === 'loading' ? (
            <>
              <span className="inline-block w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Diagnosing…
            </>
          ) : (
            '🔧 Fix'
          )}
        </button>
        <span className="text-[9px] text-[#C7C7CC]">~$0.02</span>
        {status === 'error' && (
          <span className="text-[10px] text-[#FF3B30]">⚠ {message}</span>
        )}
      </div>
    </div>
  );
}
