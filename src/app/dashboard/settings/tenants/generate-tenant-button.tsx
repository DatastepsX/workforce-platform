'use client';

import { useState, useTransition } from 'react';
import { generateTestTenant, type GeneratedTenantResult } from '@/lib/actions/tenants';

const ROLE_COLORS: Record<string, string> = {
  admin:          '#FF3B30',
  recruiter:      '#007AFF',
  hiring_manager: '#FF9500',
  procurement:    '#AF52DE',
  finance:        '#30B0C7',
  supplier:       '#34C759',
  candidate:      '#8E8E93',
};

export function GenerateTenantButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<GeneratedTenantResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      try {
        const res = await generateTestTenant();
        setResult(res);
      } catch (e) {
        setResult({ tenantId: '', tenantName: '', slug: '', industry: '', users: [], suppliers: [], candidatesCreated: 0, laddersCreated: 0, orgUnitsCreated: 0, jobDescriptionsCreated: 0, supplierCategoriesCreated: 0, costItemsEnabled: false, error: (e as Error).message });
      }
    });
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function copyAll() {
    if (!result) return;
    const text = result.users.map(u =>
      `${u.full_name} (${u.configuredLabel})\nEmail: ${u.email}\nPassword: ${u.password}`
    ).join('\n\n');
    copyToClipboard(text, 'all');
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-white text-[13px] font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#AF52DE' }}
      >
        {isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Generating…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Generate Test Client
          </>
        )}
      </button>

      {/* Result modal */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setResult(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-[#F2F2F7] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                {result.error ? (
                  <p className="text-[16px] font-bold text-[#FF3B30]">Generation failed</p>
                ) : (
                  <>
                    <p className="text-[16px] font-bold text-black">{result.tenantName}</p>
                    <p className="text-[13px] text-[#8E8E93]">{result.industry} · {result.users.length} users created</p>
                  </>
                )}
              </div>
              <button onClick={() => setResult(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8E93] hover:bg-[#F2F2F7] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {result.error ? (
              <div className="px-6 py-8 text-center">
                <p className="text-[14px] text-[#FF3B30]">{result.error}</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                {/* Summary chips */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#34C759]/10 text-[#1C7B3A]">✓ Tenant created</span>
                  <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#007AFF]/10 text-[#007AFF]">✓ Workflow configured</span>
                  <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#AF52DE]/10 text-[#AF52DE]">✓ Role labels set</span>
                  <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#FF9500]/10 text-[#FF9500]">✓ {result.users.length} users created</span>
                  {result.suppliers.length > 0 && (
                    <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#34C759]/10 text-[#1C7B3A]">✓ {result.suppliers.length} suppliers assigned</span>
                  )}
                  {result.candidatesCreated > 0 && (
                    <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#5856D6]/10 text-[#5856D6]">✓ {result.candidatesCreated} candidates generated</span>
                  )}
                  {result.laddersCreated > 0 && (
                    <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#FF9500]/10 text-[#FF9500]">✓ {result.laddersCreated} career ladders created</span>
                  )}
                  {(result.orgUnitsCreated ?? 0) > 0 && (
                    <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#AF52DE]/10 text-[#AF52DE]">✓ {result.orgUnitsCreated} org units + {result.jobDescriptionsCreated ?? 0} job descriptions</span>
                  )}
                  {(result.supplierCategoriesCreated ?? 0) > 0 && (
                    <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#30B0C7]/10 text-[#30B0C7]">✓ {result.supplierCategoriesCreated} supplier categories</span>
                  )}
                  {result.costItemsEnabled && (
                    <span className="text-[12px] font-medium px-3 py-1 rounded-full bg-[#34C759]/10 text-[#1C7B3A]">✓ Cost items enabled</span>
                  )}
                </div>

                {/* Users table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Users & Credentials</p>
                    <button
                      onClick={copyAll}
                      className="text-[12px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
                    >
                      {copied === 'all' ? '✓ Copied all' : 'Copy all'}
                    </button>
                  </div>
                  <div className="rounded-xl border border-[#E5E5EA] overflow-hidden">
                    {result.users.map((u, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#F2F2F7] last:border-0 hover:bg-[#F9F9F9] transition-colors">
                        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: ROLE_COLORS[u.role] ?? '#8E8E93' }}>
                          {u.full_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-black truncate">{u.full_name}</p>
                          <p className="text-[11px] text-[#8E8E93] truncate">{u.jobTitle}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: (ROLE_COLORS[u.role] ?? '#8E8E93') + '18', color: ROLE_COLORS[u.role] ?? '#8E8E93' }}>
                          {u.configuredLabel}
                        </span>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[11px] text-[#3C3C43] font-mono truncate max-w-[160px]">{u.email}</p>
                          <p className="text-[11px] text-[#8E8E93] font-mono">{u.password}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(`${u.email}\n${u.password}`, u.email)}
                          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#8E8E93] hover:bg-[#F2F2F7] hover:text-black transition-colors"
                          title="Copy credentials"
                        >
                          {copied === u.email ? (
                            <svg className="w-3.5 h-3.5 text-[#34C759]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suppliers section */}
                {result.suppliers.length > 0 && (
                  <div>
                    <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-3">Assigned Suppliers</p>
                    <div className="rounded-xl border border-[#E5E5EA] overflow-hidden">
                      {result.suppliers.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#F2F2F7] last:border-0">
                          <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[11px] font-bold bg-[#34C759]">
                            {s.company_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-black truncate">{s.company_name}</p>
                            <p className="text-[11px] text-[#8E8E93] truncate">{s.contact_person} · {s.email}</p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#1C7B3A] flex-shrink-0">Active</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                  <a
                    href={`/dashboard/settings/tenants/${result.tenantId}`}
                    className="flex-1 py-2.5 rounded-[10px] text-white text-[14px] font-semibold text-center transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#007AFF' }}
                  >
                    Open Tenant Config →
                  </a>
                  <button
                    onClick={() => setResult(null)}
                    className="px-5 py-2.5 rounded-[10px] text-[14px] font-medium text-[#3C3C43] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
