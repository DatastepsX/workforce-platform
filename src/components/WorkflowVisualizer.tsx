'use client';

import type { TenantConfig } from '@/types/database';

interface Stage {
  id: string;
  label: string;
  sublabel: string;
  enabled: boolean;
  phase: 'demand' | 'sourcing' | 'award' | 'terminal' | 'billing';
  conditionalFlag?: string;
}

const PHASE_COLORS = {
  demand:   { bg: '#EBF5FF', border: '#007AFF', text: '#007AFF', badge: '#007AFF' },
  sourcing: { bg: '#F0FFF4', border: '#34C759', text: '#34C759', badge: '#34C759' },
  award:    { bg: '#FFF8EB', border: '#FF9500', text: '#FF9500', badge: '#FF9500' },
  terminal: { bg: '#F0FFF4', border: '#34C759', text: '#34C759', badge: '#34C759' },
  billing:  { bg: '#F5F0FF', border: '#5856D6', text: '#5856D6', badge: '#5856D6' },
};

function buildStages(config: TenantConfig): Stage[] {
  const stages: Stage[] = [];

  stages.push({
    id: 'draft',
    label: 'Draft',
    sublabel: 'Hiring Manager',
    enabled: true,
    phase: 'demand',
  });

  stages.push({
    id: 'pending_review',
    label: 'MSP Review',
    sublabel: 'MSP Recruiter',
    enabled: config.demand_msp_review,
    phase: 'demand',
    conditionalFlag: 'MSP Review',
  });

  for (let i = 1; i <= 3; i++) {
    const roleKey = `demand_approval_role_l${i}` as keyof TenantConfig;
    const role = (config[roleKey] as string | null) ?? '—';
    stages.push({
      id: `approval_l${i}`,
      label: `Approval L${i}`,
      sublabel: role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      enabled: config.demand_approval_levels >= i,
      phase: 'demand',
      conditionalFlag: `Approval level ${i}`,
    });
  }

  stages.push({
    id: 'sourcing',
    label: 'Sourcing',
    sublabel: 'MSP Recruiter + Suppliers',
    enabled: true,
    phase: 'sourcing',
  });

  stages.push({
    id: 'screening',
    label: 'Screening',
    sublabel: 'MSP Recruiter',
    enabled: config.demand_msp_screening,
    phase: 'sourcing',
    conditionalFlag: 'MSP Screening',
  });

  stages.push({
    id: 'award',
    label: 'Award',
    sublabel: config.award_msp_offer ? 'MSP Recruiter' : 'Hiring Manager',
    enabled: true,
    phase: 'award',
    conditionalFlag: config.award_msp_offer ? 'MSP manages offer' : 'HM manages offer',
  });

  for (let i = 1; i <= 3; i++) {
    const roleKey = `award_approval_role_l${i}` as keyof TenantConfig;
    const role = (config[roleKey] as string | null) ?? '—';
    stages.push({
      id: `award_approval_l${i}`,
      label: `Award Appr. L${i}`,
      sublabel: role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      enabled: config.award_approval_levels >= i,
      phase: 'award',
      conditionalFlag: `Award approval level ${i}`,
    });
  }

  stages.push({
    id: 'contracting',
    label: 'PO / Contract',
    sublabel: 'MSP Admin',
    enabled: config.award_po_step,
    phase: 'award',
    conditionalFlag: 'PO step',
  });

  stages.push({
    id: 'filled',
    label: 'Filled',
    sublabel: 'Placement confirmed',
    enabled: true,
    phase: 'terminal',
  });

  // Cost item / billing phases
  stages.push({
    id: 'cost_entry',
    label: 'Cost Entry',
    sublabel: 'Supplier / Candidate',
    enabled: true,
    phase: 'billing',
  });

  stages.push({
    id: 'cost_msp_review',
    label: 'MSP Review',
    sublabel: 'MSP Recruiter',
    enabled: config.cost_msp_review,
    phase: 'billing',
    conditionalFlag: 'Cost MSP Review',
  });

  stages.push({
    id: 'cost_hm_approval',
    label: 'HM Approval',
    sublabel: 'Hiring Manager',
    enabled: config.cost_hm_approval,
    phase: 'billing',
    conditionalFlag: 'Cost HM Approval',
  });

  stages.push({
    id: 'cost_invoiced',
    label: 'Invoiced',
    sublabel: 'Finance / MSP',
    enabled: true,
    phase: 'billing',
  });

  return stages;
}

interface Props {
  config: TenantConfig;
}

export function WorkflowVisualizer({ config }: Props) {
  const stages = buildStages(config);

  return (
    <div>
      <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">E2E Process Flow</p>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-start gap-0 min-w-max pt-2">
          {stages.map((stage, idx) => {
            const colors = PHASE_COLORS[stage.phase];
            const isEnabled = stage.enabled;

            return (
              <div key={stage.id} className="flex items-center">
                {/* Stage box */}
                <div className="flex flex-col items-center" style={{ width: 96 }}>
                  <div
                    className="w-full rounded-xl px-2 py-2 text-center relative"
                    style={{
                      backgroundColor: isEnabled ? colors.bg : '#F2F2F7',
                      border: `1.5px ${isEnabled ? 'solid' : 'dashed'} ${isEnabled ? colors.border : '#C7C7CC'}`,
                      opacity: isEnabled ? 1 : 0.55,
                    }}
                  >
                    <p
                      className="text-[11px] font-bold leading-tight"
                      style={{ color: isEnabled ? colors.text : '#8E8E93' }}
                    >
                      {stage.label}
                    </p>
                    <p
                      className="text-[9px] mt-0.5 leading-tight"
                      style={{ color: isEnabled ? colors.text : '#C7C7CC' }}
                    >
                      {stage.sublabel}
                    </p>
                    {stage.conditionalFlag && (
                      <span
                        className="absolute -top-1.5 -right-1.5 text-[7px] font-bold px-1 py-0.5 rounded-full leading-none"
                        style={{
                          backgroundColor: isEnabled ? colors.badge : '#8E8E93',
                          color: '#fff',
                        }}
                        title={stage.conditionalFlag}
                      >
                        {isEnabled ? 'ON' : 'OFF'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow between stages */}
                {idx < stages.length - 1 && (
                  <div className="flex items-center flex-shrink-0" style={{ width: 16 }}>
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
                      <path d="M2 8h9M8 5l4 3-4 3" stroke={stages[idx + 1].enabled ? '#C7C7CC' : '#E5E5EA'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {(Object.entries(PHASE_COLORS) as [string, typeof PHASE_COLORS.demand][]).filter(([k]) => k !== 'terminal').map(([phase, c]) => (
          <div key={phase} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: c.bg, borderColor: c.border }} />
            <span className="text-[10px] text-[#8E8E93] capitalize">{phase}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm border border-dashed" style={{ backgroundColor: '#F2F2F7', borderColor: '#C7C7CC' }} />
          <span className="text-[10px] text-[#8E8E93]">Disabled by config</span>
        </div>
      </div>
    </div>
  );
}
