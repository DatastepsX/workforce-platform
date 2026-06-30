'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ComplianceRule } from '@/types/database';

const VALIDATION_LOGICS = [
  { value: 'max_daily_hours',      label: 'Maximum Daily Hours' },
  { value: 'max_weekly_hours',     label: 'Maximum Weekly Hours' },
  { value: 'min_rest_period',      label: 'Minimum Rest Period' },
  { value: 'min_wage_hourly',      label: 'Minimum Hourly Wage' },
  { value: 'aug_equal_pay',        label: 'AÜG Equal Pay Threshold' },
  { value: 'aug_max_duration',     label: 'AÜG Maximum Assignment Duration' },
  { value: 'aug_tariff_required',  label: 'AÜG Tariff Agreement Required' },
  { value: 'ir35_status',          label: 'IR35 Status (UK)' },
  { value: 'scheinselbst_status',  label: 'Scheinselbstständigkeit (DE)' },
  { value: 'vat_treatment',        label: 'VAT Treatment Check' },
  { value: 'max_per_diem',         label: 'Maximum Per Diem' },
  { value: 'max_mileage_rate',     label: 'Maximum Mileage Rate' },
  { value: 'receipt_required',     label: 'Receipt Required Above Threshold' },
  { value: 'minor_worker_hours',   label: 'Minor Worker Hours Limit' },
  { value: 'sunday_restriction',   label: 'Sunday Work Restriction' },
  { value: 'public_holiday',       label: 'Public Holiday Restriction' },
  { value: 'maternity_protection', label: 'Maternity Protection' },
  { value: 'custom',               label: 'Custom (manual verification)' },
];

const COUNTRIES = [
  { value: 'DE', label: 'Germany' },
  { value: 'AT', label: 'Austria' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'PL', label: 'Poland' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
];

const inputCls = 'w-full px-3 py-2 bg-[#F2F2F7] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]/30';

interface Props {
  rule?: ComplianceRule;
  onSave: (fd: FormData) => Promise<void>;
}

export function ComplianceRuleForm({ rule, onSave }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [logic, setLogic] = useState(rule?.validation_logic ?? 'max_daily_hours');

  const needsThreshold = !['aug_tariff_required','ir35_status','scheinselbst_status','vat_treatment','sunday_restriction','public_holiday','maternity_protection','custom'].includes(logic);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await onSave(fd);
        router.push('/dashboard/settings/compliance-rules');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 bg-[#FFF0F0] border border-[#FF3B30]/30 rounded-xl text-[13px] text-[#FF3B30]">{error}</div>}

      {/* Identity */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4">
        <h2 className="text-[15px] font-semibold text-black">Rule Identity</h2>
        <div>
          <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Rule Name <span className="text-[#FF3B30]">*</span></label>
          <input name="name" required defaultValue={rule?.name} placeholder="e.g. Maximum Daily Hours" className={inputCls} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Description</label>
          <textarea name="description" rows={2} defaultValue={rule?.description ?? ''} placeholder="Explain the legal basis or client policy behind this rule…" className={inputCls + ' resize-none'} />
        </div>
      </section>

      {/* Applicability */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-black">Applicability</h2>
          <p className="text-[12px] text-[#8E8E93]">Leave Country or Contract Type blank to apply globally</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Country</label>
            <select name="country" defaultValue={rule?.country ?? ''} className={inputCls}>
              <option value="">— All Countries —</option>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label} ({c.value})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Contract Type</label>
            <select name="contract_type" defaultValue={rule?.contract_type ?? ''} className={inputCls}>
              <option value="">— All Types —</option>
              <option value="temp">Temporary Staffing</option>
              <option value="contracting">Contracting</option>
              <option value="sow">Statement of Work</option>
              <option value="perm">Permanent</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Effective From</label>
            <input type="date" name="effective_from" defaultValue={rule?.effective_from ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Effective To</label>
            <input type="date" name="effective_to" defaultValue={rule?.effective_to ?? ''} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Validation */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4">
        <h2 className="text-[15px] font-semibold text-black">Validation Logic</h2>
        <div>
          <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Validation Logic <span className="text-[#FF3B30]">*</span></label>
          <select name="validation_logic" required value={logic} onChange={e => setLogic(e.target.value)} className={inputCls}>
            {VALIDATION_LOGICS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>

        {needsThreshold && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Threshold Value</label>
              <input type="number" step="0.01" name="threshold" defaultValue={rule?.threshold ?? ''} placeholder="e.g. 48" className={inputCls} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#3C3C43] mb-1">Unit</label>
              <select name="threshold_unit" defaultValue={rule?.threshold_unit ?? ''} className={inputCls}>
                <option value="">— Select —</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="eur">EUR (€)</option>
                <option value="percentage">Percentage (%)</option>
                <option value="km">Kilometres</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Severity & Override */}
      <section className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4">
        <h2 className="text-[15px] font-semibold text-black">Severity & Override</h2>
        <div className="grid grid-cols-3 gap-4">
          {(['info','warning','error'] as const).map(s => {
            const clsMap = { info: 'border-[#007AFF] bg-[#E8F4FD]', warning: 'border-[#FF9500] bg-[#FFF4E8]', error: 'border-[#FF3B30] bg-[#FFF0F0]' };
            const labelMap = { info: 'ℹ Info — informational only', warning: '⚠ Warning — visible but not blocking', error: '✗ Hard Stop — blocks submission' };
            return (
              <label key={s} className="cursor-pointer">
                <input type="radio" name="severity" value={s} defaultChecked={rule?.severity === s || (!rule && s === 'warning')} className="sr-only peer" />
                <div className={`p-3 rounded-xl border-2 peer-checked:${clsMap[s]} border-[#E5E5EA] hover:border-[#C7C7CC] transition-all text-[13px] font-semibold`}>
                  {labelMap[s]}
                </div>
              </label>
            );
          })}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="override_allowed" value="true" defaultChecked={rule?.override_allowed ?? false} className="accent-[#007AFF]" />
          <span className="text-[13px] font-medium text-black">Override Allowed</span>
          <span className="text-[11px] text-[#8E8E93]">— authorised users can bypass this rule with a reason</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="active" value="true" defaultChecked={rule?.active ?? true} className="accent-[#007AFF]" />
          <span className="text-[13px] font-medium text-black">Active</span>
          <span className="text-[11px] text-[#8E8E93]">— inactive rules are not evaluated during validation</span>
        </label>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="px-5 py-2.5 rounded-xl text-white text-[14px] font-semibold disabled:opacity-50" style={{ backgroundColor: '#007AFF' }}>
          {isPending ? 'Saving…' : rule ? 'Save Changes' : 'Create Rule'}
        </button>
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-[#F2F2F7] text-[#3C3C43]">Cancel</button>
      </div>
    </form>
  );
}
