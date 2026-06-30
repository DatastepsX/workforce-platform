'use client';

import { useState, useEffect } from 'react';

interface Props {
  userId: string;
  userEmail: string;
  userRole: string;
  userName: string;
  tenantId: string | null;
  tenantName: string | null;
}

function extractIds(pathname: string): Record<string, string> {
  const ids: Record<string, string> = {};
  const patterns: [string, RegExp][] = [
    ['demandId',     /\/demands\/([a-f0-9-]{36})/],
    ['supplierId',   /\/suppliers\/([a-f0-9-]{36})/],
    ['awardId',      /\/awards\/([a-f0-9-]{36})/],
    ['candidateId',  /\/candidates\/([a-f0-9-]{36})/],
    ['engagementId', /\/engagements\/([a-f0-9-]{36})/],
    ['tenantConfigId', /\/tenants\/([a-f0-9-]{36})/],
  ];
  for (const [key, re] of patterns) {
    const m = pathname.match(re);
    if (m) ids[key] = m[1];
  }
  return ids;
}

export function DevDebugInfo({ userId, userEmail, userRole, userName, tenantId, tenantName }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!open) return;
    const url = window.location.href;
    const pathname = window.location.pathname;
    const ids = extractIds(pathname);
    const now = new Date();

    const lines = [
      '=== WorkforceX Debug Info ===',
      `Timestamp : ${now.toISOString()} (${now.toLocaleString('de-DE')})`,
      '',
      '--- User ---',
      `Name      : ${userName || '—'}`,
      `Email     : ${userEmail}`,
      `Role      : ${userRole}`,
      `User ID   : ${userId}`,
      '',
      '--- Tenant ---',
      `Name      : ${tenantName || '—'}`,
      `Tenant ID : ${tenantId || '—'}`,
      '',
      '--- Page ---',
      `URL       : ${url}`,
      `Path      : ${pathname}`,
      ...Object.entries(ids).map(([k, v]) => `${k.padEnd(12)}: ${v}`),
      '',
      '--- Browser ---',
      `Viewport  : ${window.innerWidth}×${window.innerHeight}`,
      `UA        : ${navigator.userAgent.substring(0, 80)}`,
    ];

    setInfo(lines.join('\n'));
  }, [open, userId, userEmail, userRole, userName, tenantId, tenantName]);

  function handleCopy() {
    navigator.clipboard.writeText(info).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        title="Copy debug info"
        className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold transition-colors flex-shrink-0 hover:bg-[#F2F2F7]"
        style={{ color: '#8E8E93' }}
      >
        ℹ
      </button>

      {open && (
        <div
          className="fixed z-[300] bg-black/90 rounded-2xl overflow-hidden"
          style={{
            bottom: '88px',
            right: '16px',
            left: '16px',
            width: 'auto',
            maxWidth: '360px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/10">
            <span className="text-[12px] font-bold text-white tracking-wide">Debug Info</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                style={{ backgroundColor: copied ? '#34C759' : '#5856D6', color: '#fff' }}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-white/50 hover:text-white transition-colors text-[16px] leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <pre className="px-4 py-3 text-[10px] text-[#A8FF78] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {info}
          </pre>
        </div>
      )}
    </>
  );
}
