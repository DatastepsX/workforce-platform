'use client';

import { useState, useTransition } from 'react';
import {
  STAGE_ORDER,
  STAGE_LABELS,
  STATUS_LABELS,
  STATUS_NEXT_STEP,
  getStageIndex,
  isTerminalStage,
  getTransitionsForStatus,
} from '@/lib/workflow/state-machine';
import { transitionDemandStatus } from '@/lib/actions/workflow';
import type { ProcessStage, DemandProcessStatus, ProcessHistoryEntry } from '@/lib/workflow/types';
import type { UserRole } from '@/types/database';

interface ProcessPanelProps {
  demandId: string;
  processStage: ProcessStage;
  processStatus: DemandProcessStatus;
  currentOwnerRole: string | null;
  role: UserRole;
  history: ProcessHistoryEntry[];
}

const ACTOR_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  recruiter: 'Service Team',
  hiring_manager: 'Hiring Manager',
  supplier: 'Lieferant',
  candidate: 'Kandidat',
};

const ACTION_LABELS: Record<string, string> = {
  SUBMIT: 'Eingereicht',
  APPROVE_AND_PUBLISH: 'Genehmigt & ausgeschrieben',
  RETURN_FOR_REVISION: 'Zur Überarbeitung zurückgesendet',
  REJECT: 'Abgelehnt',
  RESUBMIT: 'Erneut eingereicht',
  START_REVIEW: 'Sichtung gestartet',
  REVIEW: 'Detailprüfung gestartet',
  SHORTLIST: 'Shortlist erstellt',
  START_INTERVIEWS: 'Interviews gestartet',
  COMPLETE_INTERVIEWS: 'Interviews abgeschlossen',
  SELECT_CANDIDATE: 'Kandidat ausgewählt',
  CONFIRM_AND_REQUEST_APPROVAL: 'Freigabe eingeleitet',
  GRANT_APPROVAL: 'Freigabe erteilt',
  REJECT_APPROVAL: 'Freigabe verweigert',
  START_ONBOARDING: 'Onboarding gestartet',
  COMPLETE_ONBOARDING: 'Onboarding abgeschlossen',
  END: 'Beendet',
  PUT_ON_HOLD: 'Pausiert',
  RESUME: 'Fortgesetzt',
  CANCEL: 'Abgebrochen',
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `vor ${d} Tag${d !== 1 ? 'en' : ''}`;
  if (h > 0) return `vor ${h} Std.`;
  if (m > 0) return `vor ${m} Min.`;
  return 'gerade eben';
}

export function ProcessPanel({
  demandId, processStage, processStatus, role, history,
}: ProcessPanelProps) {
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const isTerminal = isTerminalStage(processStage);
  const currentStageIdx = getStageIndex(processStage);
  const transitions = getTransitionsForStatus(processStatus, role);
  const primaryTransitions = transitions.filter(t => !t.isDangerous);
  const dangerTransitions = transitions.filter(t => t.isDangerous);

  const pendingTransition = activeAction ? transitions.find(t => t.action === activeAction) : null;
  const needsNote = pendingTransition?.requiresNote;

  function handleTransition(action: string) {
    const t = transitions.find(tr => tr.action === action);
    if (!t) return;
    if (t.requiresNote) {
      setActiveAction(action);
      setNoteText('');
      setErrorMsg('');
      return;
    }
    execTransition(action);
  }

  function execTransition(action: string, note?: string) {
    setErrorMsg('');
    startTransition(async () => {
      const result = await transitionDemandStatus(demandId, action, note);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setActiveAction(null);
        setNoteText('');
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden mb-4">
      {/* Stage stepper */}
      <div className="px-5 pt-5 pb-4 border-b border-[#F2F2F7]">
        <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-4">
          Prozessstatus
        </p>
        <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-none">
          {STAGE_ORDER.map((stage, idx) => {
            const isActive = stage === processStage && !isTerminal;
            const isPast = !isTerminal && currentStageIdx > idx;
            const isLast = idx === STAGE_ORDER.length - 1;
            return (
              <div key={stage} className="flex items-center flex-shrink-0">
                {/* Step pill */}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: isActive
                        ? '#007AFF'
                        : isPast
                        ? '#34C759'
                        : '#E5E5EA',
                    }}
                  >
                    {isPast ? (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className="text-[9px] font-bold" style={{ color: isActive ? 'white' : '#8E8E93' }}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-medium whitespace-nowrap"
                    style={{ color: isActive ? '#007AFF' : isPast ? '#34C759' : '#8E8E93' }}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                {/* Connector */}
                {!isLast && (
                  <div
                    className="h-[2px] w-5 flex-shrink-0 mx-0.5 rounded-full mb-4"
                    style={{ backgroundColor: isPast ? '#34C759' : '#E5E5EA' }}
                  />
                )}
              </div>
            );
          })}

          {/* Terminal stage indicator */}
          {isTerminal && (
            <>
              <div className="h-[2px] w-5 flex-shrink-0 mx-0.5 rounded-full mb-4 bg-[#E5E5EA]" />
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor:
                      processStage === 'CANCELLED' || processStage === 'REJECTED'
                        ? '#FF3B30'
                        : '#FF9500',
                  }}
                >
                  <span className="text-[9px] font-bold text-white">!</span>
                </div>
                <span
                  className="text-[10px] font-medium whitespace-nowrap"
                  style={{
                    color:
                      processStage === 'CANCELLED' || processStage === 'REJECTED'
                        ? '#FF3B30'
                        : '#FF9500',
                  }}
                >
                  {STAGE_LABELS[processStage]}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status card */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold text-black leading-tight mb-1">
              {STATUS_LABELS[processStatus]}
            </p>
            <p className="text-[13px] text-[#8E8E93] leading-relaxed">
              {STATUS_NEXT_STEP[processStatus]}
            </p>
          </div>
          {/* Stage badge */}
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
            style={{
              backgroundColor: isTerminal
                ? (processStage === 'ON_HOLD' ? '#FF950018' : '#FF3B3018')
                : '#007AFF18',
              color: isTerminal
                ? (processStage === 'ON_HOLD' ? '#FF9500' : '#FF3B30')
                : '#007AFF',
            }}
          >
            {STAGE_LABELS[processStage]}
          </span>
        </div>

        {/* Action buttons */}
        {!isTerminal && transitions.length > 0 && (
          <div className="mt-4 space-y-3">
            {/* Note input (for requiresNote transitions) */}
            {activeAction && needsNote && (
              <div className="bg-[#F2F2F7] rounded-[14px] p-3.5 space-y-2.5">
                <p className="text-[13px] font-semibold text-black">
                  {pendingTransition?.label}
                </p>
                <p className="text-[12px] text-[#8E8E93]">
                  Bitte Begründung angeben:
                </p>
                <textarea
                  className="w-full bg-white rounded-[10px] border border-[#E5E5EA] px-3 py-2 text-[14px] text-black resize-none outline-none focus:border-[#007AFF] transition-colors"
                  rows={3}
                  placeholder="Notiz eingeben..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => execTransition(activeAction, noteText)}
                    disabled={pending || !noteText.trim()}
                    className="px-4 py-2 bg-[#007AFF] text-white text-[13px] font-semibold rounded-[10px] hover:bg-[#0066DD] transition-colors disabled:opacity-40"
                  >
                    Bestätigen
                  </button>
                  <button
                    onClick={() => { setActiveAction(null); setNoteText(''); setErrorMsg(''); }}
                    className="px-4 py-2 bg-[#F2F2F7] text-[#3C3C43] text-[13px] font-semibold rounded-[10px] hover:bg-[#E5E5EA] transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Primary action buttons */}
            {!activeAction && primaryTransitions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {primaryTransitions.map(t => (
                  <button
                    key={t.action}
                    onClick={() => handleTransition(t.action)}
                    disabled={pending}
                    title={t.description}
                    className="px-4 py-2 bg-[#007AFF] text-white text-[13px] font-semibold rounded-[12px] hover:bg-[#0066DD] active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {t.ownerLabel && (
                      <span className="text-white/70 text-[11px]">→ {t.ownerLabel}</span>
                    )}
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Danger zone */}
            {!activeAction && dangerTransitions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {dangerTransitions.map(t => (
                  <button
                    key={t.action}
                    onClick={() => handleTransition(t.action)}
                    disabled={pending}
                    title={t.description}
                    className="px-3 py-1.5 text-[#FF3B30] text-[12px] font-semibold rounded-[10px] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 active:scale-95 transition-all disabled:opacity-40"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <p className="text-[13px] text-[#FF3B30] font-medium">{errorMsg}</p>
            )}
          </div>
        )}

        {/* Terminal state message */}
        {isTerminal && (
          <div
            className="mt-3 px-3 py-2 rounded-[10px] text-[13px] font-medium"
            style={{
              backgroundColor: processStage === 'ON_HOLD' ? '#FF950012' : '#FF3B3012',
              color: processStage === 'ON_HOLD' ? '#FF9500' : '#FF3B30',
            }}
          >
            {processStage === 'ENDED' && 'Beauftragung erfolgreich abgeschlossen.'}
            {processStage === 'CANCELLED' && 'Anfrage wurde abgebrochen.'}
            {processStage === 'REJECTED' && 'Anfrage wurde abgelehnt.'}
            {processStage === 'ON_HOLD' && 'Prozess ist pausiert.'}
          </div>
        )}

        {/* Resume button for ON_HOLD */}
        {processStage === 'ON_HOLD' && transitions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {transitions.map(t => (
              <button
                key={t.action}
                onClick={() => handleTransition(t.action)}
                disabled={pending}
                className="px-4 py-2 bg-[#007AFF] text-white text-[13px] font-semibold rounded-[12px] hover:bg-[#0066DD] active:scale-95 transition-all disabled:opacity-40"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="border-t border-[#F2F2F7]">
          <button
            className="w-full px-5 py-3 flex items-center justify-between text-[13px] font-semibold text-[#8E8E93] hover:text-black hover:bg-[#F9F9F9] transition-colors"
            onClick={() => setShowHistory(h => !h)}
          >
            <span>Verlauf ({history.length})</span>
            <svg
              className="w-4 h-4 transition-transform"
              style={{ transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showHistory && (
            <div className="px-5 pb-4 space-y-2.5">
              {history.map(entry => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C7C7CC] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-semibold text-black">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                      {entry.actor_role && (
                        <span className="text-[11px] text-[#8E8E93]">
                          · {ACTOR_ROLE_LABELS[entry.actor_role] ?? entry.actor_role}
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-[12px] text-[#8E8E93] mt-0.5 italic">{entry.notes}</p>
                    )}
                    <p className="text-[11px] text-[#C7C7CC] mt-0.5">{fmtRelative(entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
