'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runScenarioAction } from '@/lib/actions/scenario-runs';

interface Props {
  tenantId: string;
  tenantName: string;
  compact?: boolean;
}

export function RunScenarioButton({ tenantId, tenantName, compact = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [lastError, setLastError] = useState<string | null>(null);
  const [justRan, setJustRan] = useState(false);
  const router = useRouter();

  function handleRun() {
    setLastError(null);
    setJustRan(false);
    startTransition(async () => {
      const result = await runScenarioAction(tenantId);
      if (result.success) {
        setJustRan(true);
        router.refresh();
        setTimeout(() => setJustRan(false), 3000);
      } else {
        setLastError(result.error ?? 'Unknown error');
      }
    });
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleRun}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: justRan ? '#34C759' : '#5856D6' }}
        >
          {isPending ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running…
            </>
          ) : justRan ? (
            '✓ Done'
          ) : (
            <>🧪 Run Tests</>
          )}
        </button>
        {lastError && <span className="text-[11px] text-[#FF3B30]">{lastError}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleRun}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-all disabled:opacity-60 w-full justify-center"
        style={{ backgroundColor: justRan ? '#34C759' : '#5856D6' }}
      >
        {isPending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Running scenarios for {tenantName}…
          </>
        ) : justRan ? (
          '✓ Scenarios complete — results saved'
        ) : (
          <>🧪 Run Scenarios for {tenantName}</>
        )}
      </button>
      {lastError && (
        <p className="text-[11px] text-[#FF3B30] text-center">{lastError}</p>
      )}
      {isPending && (
        <p className="text-[10px] text-[#8E8E93] text-center">
          Simulating happy + unhappy paths · generating AI optimisation ideas…
        </p>
      )}
    </div>
  );
}
