'use client';

import { SOFT_SKILLS, type SoftSkill } from '@/types/database';

const SHORT_LABELS: Record<SoftSkill, string> = {
  communication:       'Kommunik.',
  leadership:          'Leadership',
  teamwork:            'Teamfähig.',
  analytical_thinking: 'Analytik',
  problem_solving:     'Problemlös.',
  creativity:          'Kreativität',
  project_management:  'Proj.mgmt.',
  negotiation:         'Verhandlung',
  customer_orientation:'Kundennähe',
  data_analytics:      'Data Analyt.',
  presentation:        'Präsent.',
  organization:        'Organisation',
};

const N = SOFT_SKILLS.length; // 12
const R = 105; // max radius
const CX = 0;
const CY = 0;

function toXY(angle: number, r: number) {
  return {
    x: CX + r * Math.cos(angle),
    y: CY + r * Math.sin(angle),
  };
}

// Angles start from -90° (top) going clockwise
function axisAngle(i: number) {
  return -Math.PI / 2 + (i * 2 * Math.PI) / N;
}

function polygonPoints(values: number[]): string {
  return values
    .map((v, i) => {
      const r = (v / 5) * R;
      const { x, y } = toXY(axisAngle(i), r);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function gridPolygon(fraction: number): string {
  return Array.from({ length: N }, (_, i) => {
    const { x, y } = toXY(axisAngle(i), R * fraction);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

interface Props {
  selfRatings: Partial<Record<SoftSkill, number>>;
  aiRatings:   Partial<Record<SoftSkill, number>>;
}

export function SkillRadar({ selfRatings, aiRatings }: Props) {
  const selfVals = SOFT_SKILLS.map(s => selfRatings[s] ?? 0);
  const aiVals   = SOFT_SKILLS.map(s => aiRatings[s]   ?? 0);

  const hasSelf = selfVals.some(v => v > 0);
  const hasAI   = aiVals.some(v => v > 0);

  return (
    <div className="w-full">
      <svg
        viewBox="-190 -190 380 380"
        className="w-full max-w-[380px] mx-auto"
        style={{ overflow: 'visible' }}
      >
        {/* Grid polygons */}
        {[0.2, 0.4, 0.6, 0.8, 1].map(f => (
          <polygon
            key={f}
            points={gridPolygon(f)}
            fill="none"
            stroke="#E5E5EA"
            strokeWidth={f === 1 ? 1.5 : 0.8}
          />
        ))}

        {/* Axis lines */}
        {SOFT_SKILLS.map((_, i) => {
          const { x, y } = toXY(axisAngle(i), R);
          return (
            <line key={i} x1={CX} y1={CY} x2={x} y2={y}
              stroke="#E5E5EA" strokeWidth={0.8} />
          );
        })}

        {/* AI rating polygon */}
        {hasAI && (
          <polygon
            points={polygonPoints(aiVals)}
            fill="rgba(88,86,214,0.12)"
            stroke="#5856D6"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {/* Self rating polygon */}
        {hasSelf && (
          <polygon
            points={polygonPoints(selfVals)}
            fill="rgba(0,122,255,0.14)"
            stroke="#007AFF"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {/* Axis labels */}
        {SOFT_SKILLS.map((skill, i) => {
          const angle = axisAngle(i);
          const labelR = R + 22;
          const { x, y } = toXY(angle, labelR);
          const degNorm = ((angle * 180) / Math.PI + 360) % 360;
          const anchor = degNorm > 10 && degNorm < 170 ? 'start'
                       : degNorm > 190 && degNorm < 350 ? 'end'
                       : 'middle';
          return (
            <text
              key={skill}
              x={x.toFixed(2)}
              y={y.toFixed(2)}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={9.5}
              fill="#3C3C43"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {SHORT_LABELS[skill]}
            </text>
          );
        })}

        {/* Center dot */}
        <circle cx={CX} cy={CY} r={2.5} fill="#C7C7CC" />
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 mt-3">
        {hasSelf && (
          <div className="flex items-center gap-1.5">
            <span className="w-8 h-0.5 rounded-full bg-[#007AFF] block" />
            <span className="text-[11px] text-[#8E8E93]">Selbsteinschätzung</span>
          </div>
        )}
        {hasAI && (
          <div className="flex items-center gap-1.5">
            <span className="w-8 h-0.5 rounded-full bg-[#5856D6] block" />
            <span className="text-[11px] text-[#8E8E93]">KI-Einschätzung</span>
          </div>
        )}
      </div>
    </div>
  );
}
