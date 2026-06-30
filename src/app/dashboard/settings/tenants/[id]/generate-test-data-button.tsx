'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

interface Props {
  tenantId: string;
}

export function GenerateTestDataButton({ tenantId }: Props) {
  const [isOpen,      setIsOpen]     = useState(false);
  const [isRunning,   setIsRunning]  = useState(false);
  const [isDone,      setIsDone]     = useState(false);
  const [log,         setLog]        = useState<LogEntry[]>([]);
  const [scenarioCount, setScenarioCount] = useState(0);
  const [fatalError,  setFatalError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  function reset() {
    setLog([]);
    setIsDone(false);
    setFatalError(null);
    setScenarioCount(0);
  }

  async function handleGenerate() {
    reset();
    setIsOpen(true);
    setIsRunning(true);

    try {
      const response = await fetch('/api/generate-tenant-test-data', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        setFatalError((err as { error?: string }).error ?? 'Request failed');
        setIsRunning(false);
        setIsDone(true);
        return;
      }

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              msg?: string;
              type?: 'info' | 'success' | 'error' | 'warn';
              done?: boolean;
              count?: number;
              error?: string;
            };

            if (payload.msg) {
              setLog(prev => [...prev, { msg: payload.msg!, type: payload.type ?? 'info' }]);
            }
            if (payload.done) {
              setIsDone(true);
              if (payload.count) setScenarioCount(payload.count);
              if (payload.error) setFatalError(payload.error);
            }
          } catch { /* malformed line — skip */ }
        }
      }
    } catch (e) {
      setFatalError((e as Error).message);
    } finally {
      setIsRunning(false);
      setIsDone(true);
    }
  }

  function handleClose() {
    if (isRunning) return; // prevent close while running
    setIsOpen(false);
    reset();
  }

  // ── Log line styling ─────────────────────────────────────────────────────
  function logLineColor(type: LogEntry['type']): string {
    switch (type) {
      case 'success': return '#34C759';
      case 'error':   return '#FF3B30';
      case 'warn':    return '#FF9500';
      default:        return '#A0AEC0'; // muted white for info
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleGenerate}
        disabled={isRunning}
        className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-white text-[13px] font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#5856D6' }}
      >
        {isRunning ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Generating…
          </>
        ) : (
          <>
            {/* Lightning bolt icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L4.09 13H11L10 22L20.9 11H14L13 2Z" />
            </svg>
            Generate Test Data
          </>
        )}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={handleClose}
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-2xl rounded-2xl shadow-[0_12px_60px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col"
            style={{ backgroundColor: '#111827', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: '#5856D6' }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L4.09 13H11L10 22L20.9 11H14L13 2Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-[15px] font-semibold">E2E Test Data Generator</p>
                  <p className="text-white/50 text-[12px]">15 scenarios · demands · submissions · awards · billing periods</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isRunning}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Log output */}
            <div
              className="flex-1 overflow-y-auto px-5 py-4 font-mono text-[12px] leading-relaxed"
              style={{ backgroundColor: '#0D1117', minHeight: 320 }}
            >
              {log.length === 0 && !isDone && (
                <p className="text-white/30 italic">Connecting to generation engine…</p>
              )}

              {log.map((entry, i) => (
                <div key={i} className="flex gap-2 mb-0.5">
                  <span
                    className="flex-shrink-0"
                    style={{ color: logLineColor(entry.type) }}
                  >
                    {entry.type === 'success' ? '✓' : entry.type === 'error' ? '✗' : entry.type === 'warn' ? '⚠' : '·'}
                  </span>
                  <span style={{ color: logLineColor(entry.type) }}>
                    {entry.msg}
                  </span>
                </div>
              ))}

              {/* Running indicator */}
              {isRunning && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#5856D6] animate-pulse" />
                  <span className="text-white/40 text-[11px]">running…</span>
                </div>
              )}

              <div ref={logEndRef} />
            </div>

            {/* Footer — shown after completion */}
            {isDone && (
              <div className="border-t border-white/10 px-5 py-4" style={{ backgroundColor: '#111827' }}>
                {fatalError ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-[#FF3B30] text-[13px] font-semibold">Generation failed</p>
                      <p className="text-[#FF3B30]/70 text-[12px] mt-0.5">{fatalError}</p>
                    </div>
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 rounded-xl bg-white/10 text-white text-[13px] font-medium hover:bg-white/20 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-[#34C759] text-[13px] font-semibold">
                        {scenarioCount}/15 scenarios generated successfully
                      </p>
                      <p className="text-white/50 text-[12px] mt-0.5">
                        Demands · Submissions · Awards · Billing Periods · Cost Entries
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/dev/test-scenarios?tenantId=${tenantId}`}
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 rounded-xl text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#5856D6' }}
                      >
                        Run E2E Scenarios →
                      </Link>
                      <button
                        onClick={handleClose}
                        className="px-4 py-2 rounded-xl bg-white/10 text-white text-[13px] font-medium hover:bg-white/20 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
