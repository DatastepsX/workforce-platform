'use client';

import { useState, useTransition } from 'react';
import { transitionDemandStatus } from '@/lib/actions/workflow';
import { getTransitions, STATUS_LABELS, STATUS_COLORS, PHASE_ORDER, PHASE_LABELS, isTerminal } from '@/lib/workflow';
import type { DemandStatus, UserRole, TenantConfig, ProcessHistoryEntry } from '@/types/database';

interface Props {
  demandId: string;
  status: DemandStatus;
  approvalLevel: number | null;
  role: UserRole;
  config: TenantConfig;
  history: ProcessHistoryEntry[];
}

const HISTORY_ACTION_LABELS: Record<string, string> = {
  SUBMIT:                'Submitted for review',
  APPROVE_REVIEW:        'Approved by MSP',
  RETURN:                'Returned for revision',
  REJECT:                'Rejected',
  APPROVE:               'Approved',
  START_SCREENING:       'Screening started',
  START_INTERVIEWS:      'Moved to interview',
  BACK_TO_SOURCING:      'Returned to sourcing',
  BACK_TO_SCREENING:     'Returned to screening',
  SELECT_CANDIDATE:      'Candidate selected',
  APPROVE_AWARD:         'Award approved',
  CONFIRM_PO:            'PO confirmed — Filled',
  PUT_ON_HOLD:           'Put on hold',
  RESUME:                'Resumed',
  CANCEL:                'Cancelled',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  recruiter: 'MSP Recruiter',
  hiring_manager: 'Hiring Manager',
  supplier: 'Supplier',
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

// Which phases to show in the stepper based on config
function visiblePhases(config: TenantConfig): DemandStatus[] {
  return PHASE_ORDER.filter(p => {
    if (p === 'pending_review' && !config.demand_msp_review) return false;
    if (p === 'pending_approval' && config.demand_approval_levels === 0) return false;
    if (p === 'contracting' && !config.award_po_step) return false;
    return true;
  });
}

function phaseIndex(status: DemandStatus, phases: DemandStatus[]): number {
  const idx = phases.indexOf(status);
  if (idx >= 0) return idx;
  // Terminal statuses don't appear in phase order
  return -1;
}

export function ProcessPanel({ demandId, status, approvalLevel, role, config, history }: Props) {
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const transitions = getTransitions(status, approvalLevel, config, role);
  const primaryTransitions = transitions.filter(t => !t.isDangerous);
  const dangerTransitions = transitions.filter(t => t.isDangerous);
  const pendingTransition = activeAction ? transitions.find(t => t.action === activeAction) : null;
  const terminal = isTerminal(status);
  const phases = visiblePhases(config);
  const currentIdx = phaseIndex(status, phases);

  function handleAction(action: string) {
    const t = transitions.find(tr => tr.action === action);
    if (!t) return;
    if (t.requiresNote) {
      setActiveAction(action);
      setNoteText('');
      setError('');
      return;
    }
    execute(action);
  }

  function execute(action: string, note?: string) {
    setError('');
    startTransition(async () => {
      const result = await transitionDemandStatus(demandId, action, note);
      if (result.error) {
        setError(result.error);
      } else {
        setActiveAction(null);
        setNoteText('');
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden mb-5">

      {/* Stage stepper */}
      <div className="px-5 pt-5 pb-4 border-b border-[#F2F2F7] overflow-x-auto">
        <div className="flex items-start min-w-max gap-0">
          {phases.map((phase, idx) => {
            const isActive = phase === status && !terminal;
            const isPast = !terminal && currentIdx > idx;
            const isLast = idx === phases.length - 1;
            return (
              <div key={phase} className="flex items-start">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      backgroundColor: isActive ? STATUS_COLORS[status] : isPast ? '#34C759' : '#E5E5EA',
                    }}
                  >
                    {isPast ? (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
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
                    style={{
                      color: isActive ? STATUS_COLORS[status] : isPast ? '#34C759' : '#8E8E93',
                    }}
                  >
                    {PHASE_LABELS[phase] ?? phase}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className="h-[2px] w-6 mt-3 mx-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isPast ? '#34C759' : '#E5E5EA' }}
                  />
                )}
              </div>
            );
          })}

          {/* Terminal indicator */}
          {terminal && (
            <>
              <div className="h-[2px] w-6 mt-3 mx-0.5 rounded-full bg-[#E5E5EA]" />
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                >
                  {status === 'filled' ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className="text-[9px] font-bold text-white">✕</span>
                  )}
                </div>
                <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: STATUS_COLORS[status] }}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status card */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-[13px] font-semibold px-3 py-1 rounded-full"
            style={{
              backgroundColor: STATUS_COLORS[status] + '18',
              color: STATUS_COLORS[status],
            }}
          >
            {STATUS_LABELS[status]}
          </span>
          {approvalLevel && (status === 'pending_approval' || status === 'award') && (
            <span className="text-[12px] text-[#8E8E93]">
              Level {approvalLevel} of {status === 'pending_approval' ? config.demand_approval_levels : config.award_approval_levels}
            </span>
          )}
        </div>

        {/* Note input */}
        {activeAction && pendingTransition?.requiresNote && (
          <div className="bg-[#F2F2F7] rounded-[14px] p-4 mb-3 space-y-3">
            <p className="text-[13px] font-semibold text-black">{pendingTransition.label}</p>
            <p className="text-[12px] text-[#8E8E93]">Note required:</p>
            <textarea
              rows={3}
              className="w-full bg-white rounded-[10px] border border-[#E5E5EA] px-3 py-2 text-[14px] resize-none outline-none focus:border-[#007AFF] transition-colors"
              placeholder="Enter a note…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => execute(activeAction, noteText)}
                disabled={pending || !noteText.trim()}
                className="px-4 py-2 bg-[#007AFF] text-white text-[13px] font-semibold rounded-[10px] hover:bg-[#0066DD] disabled:opacity-40 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => { setActiveAction(null); setError(''); }}
                className="px-4 py-2 bg-[#E5E5EA] text-[#3C3C43] text-[13px] font-semibold rounded-[10px] hover:bg-[#D1D1D6] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Primary actions */}
        {!activeAction && primaryTransitions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {primaryTransitions.map(t => (
              <button
                key={t.action}
                onClick={() => handleAction(t.action)}
                disabled={pending}
                title={t.description}
                className="px-4 py-2 bg-[#007AFF] text-white text-[13px] font-semibold rounded-[12px] hover:bg-[#0066DD] active:scale-95 disabled:opacity-40 transition-all"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Danger actions */}
        {!activeAction && dangerTransitions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {dangerTransitions.map(t => (
              <button
                key={t.action}
                onClick={() => handleAction(t.action)}
                disabled={pending}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all active:scale-95 disabled:opacity-40"
                style={{
                  color: t.action === 'PUT_ON_HOLD' ? '#FF9500' : '#FF3B30',
                  backgroundColor: t.action === 'PUT_ON_HOLD' ? '#FF950012' : '#FF3B3012',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-[13px] text-[#FF3B30] mt-2 font-medium">{error}</p>}

        {terminal && transitions.length === 0 && (
          <p className="text-[13px] text-[#8E8E93]">
            {status === 'filled' && 'Position filled — contractor confirmed.'}
            {status === 'cancelled' && 'This demand has been cancelled.'}
            {status === 'rejected' && 'This demand was rejected.'}
          </p>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="border-t border-[#F2F2F7]">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full px-5 py-3 flex items-center justify-between text-[13px] font-semibold text-[#8E8E93] hover:bg-[#F9F9F9] transition-colors"
          >
            <span>History ({history.length})</span>
            <svg
              className="w-4 h-4 transition-transform"
              style={{ transform: showHistory ? 'rotate(180deg)' : undefined }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showHistory && (
            <div className="px-5 pb-4 space-y-3">
              {history.map(entry => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C7C7CC] mt-[5px] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-[13px] font-semibold text-black">
                        {HISTORY_ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                      {entry.actor_role && (
                        <span className="text-[11px] text-[#8E8E93]">
                          · {ROLE_LABELS[entry.actor_role] ?? entry.actor_role}
                        </span>
                      )}
                      <span className="text-[11px] text-[#C7C7CC] ml-auto">{fmtRelative(entry.created_at)}</span>
                    </div>
                    {entry.notes && (
                      <p className="text-[12px] text-[#8E8E93] mt-0.5 italic">{entry.notes}</p>
                    )}
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
