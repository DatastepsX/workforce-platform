'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { applyToDemand } from '@/lib/actions/applications';

async function generateTestData(demandId: string, demandTitle: string) {
  const res = await fetch('/api/generate-test-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: `/careers/${demandId}/apply`,
      fields: [
        { name: 'name', type: 'text', label: 'Full Name', placeholder: 'Maria Schmidt' },
        { name: 'email', type: 'email', label: 'Email Address' },
        { name: 'phone', type: 'tel', label: 'Phone', placeholder: '+49 170 1234567' },
        { name: 'cover_letter', type: 'textarea', label: 'Cover Letter', placeholder: `I am applying for the ${demandTitle} position because…` },
      ],
    }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<Record<string, string>>;
}

type Step = 'details' | 'account' | 'motivation' | 'success';

const STEP_LABELS: Record<Step, string> = {
  details: 'About you',
  account: 'Create account',
  motivation: 'Your application',
  success: 'Done',
};
const STEPS: Step[] = ['details', 'account', 'motivation', 'success'];

interface Props {
  demandId: string;
  demandTitle: string;
}

function StepIndicator({ current }: { current: Step }) {
  const activeSteps = STEPS.slice(0, -1); // exclude 'success' from indicator
  const currentIdx = activeSteps.indexOf(current);
  return (
    <div className="flex items-center gap-2">
      {activeSteps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
            i < currentIdx ? 'bg-[#34C759] text-white' :
            i === currentIdx ? 'bg-[#007AFF] text-white' :
            'bg-[#E5E5EA] text-[#8E8E93]'
          }`}>
            {i < currentIdx ? '✓' : i + 1}
          </div>
          <span className={`text-[12px] font-medium ${i === currentIdx ? 'text-black' : 'text-[#8E8E93]'}`}>
            {STEP_LABELS[s]}
          </span>
          {i < activeSteps.length - 1 && <div className="w-6 h-px bg-[#E5E5EA] mx-1" />}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[#8E8E93] mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full h-11 px-4 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all";

export function ApplyForm({ demandId, demandTitle }: Props) {
  const [step, setStep] = useState<Step>('details');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isFilling, setIsFilling] = useState(false);

  // Form data collected across steps
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    password: '', confirmPassword: '',
    coverLetter: '',
  });

  function update(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  async function fillAI() {
    setIsFilling(true);
    try {
      const data = await generateTestData(demandId, demandTitle);
      if (data) {
        setForm(prev => ({
          ...prev,
          name: data.name || prev.name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          password: 'Test1234!',
          confirmPassword: 'Test1234!',
          coverLetter: data.cover_letter || prev.coverLetter,
        }));
      }
    } finally {
      setIsFilling(false);
    }
  }

  function nextFromDetails() {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setStep('account');
  }

  function nextFromAccount() {
    if (!form.password) { setError('Please set a password.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    setStep('motivation');
  }

  function submit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('demand_id', demandId);
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('phone', form.phone);
      fd.append('password', form.password);
      fd.append('cover_letter', form.coverLetter);

      const result = await applyToDemand(fd);

      if (result.emailExists) {
        setError('An account with this email already exists. Please sign in to apply.');
        setStep('account');
        return;
      }
      if (result.error) { setError(result.error); return; }
      setStep('success');
    });
  }

  if (step === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-[#34C759]/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-[24px] font-bold text-black mb-2">Application submitted!</h2>
        <p className="text-[15px] text-[#8E8E93] mb-1">
          Your application for <strong className="text-black">{demandTitle}</strong> has been received.
        </p>
        <p className="text-[14px] text-[#8E8E93] mb-6">
          We created your account — sign in to complete your profile and track your application.
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3.5 rounded-2xl text-white text-[15px] font-semibold"
          style={{ backgroundColor: '#007AFF' }}
        >
          Sign in to your account →
        </Link>
        <p className="mt-4">
          <Link href="/careers" className="text-[13px] text-[#8E8E93] hover:text-[#007AFF]">
            Browse more positions
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <StepIndicator current={step} />
        <button
          type="button"
          onClick={fillAI}
          disabled={isFilling}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-[#007AFF] bg-[#007AFF]/8 hover:bg-[#007AFF]/15 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {isFilling ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
          )}
          {isFilling ? 'Generating…' : 'Fill with AI'}
        </button>
      </div>

      {/* Step 1: About you */}
      {step === 'details' && (
        <div className="space-y-4">
          <Field label="Full Name *">
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Maria Schmidt"
              autoFocus
              className={inputCls}
            />
          </Field>
          <Field label="Email Address *">
            <input
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="maria@example.com"
              className={inputCls}
            />
          </Field>
          <Field label="Phone" hint="Optional — helps us reach you faster">
            <input
              type="tel"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
              placeholder="+49 170 1234567"
              className={inputCls}
            />
          </Field>
          {error && <p className="text-[13px] text-[#FF3B30]">{error}</p>}
          <button
            onClick={nextFromDetails}
            className="w-full h-12 rounded-2xl text-white text-[16px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#007AFF' }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 2: Account */}
      {step === 'account' && (
        <div className="space-y-4">
          <div className="bg-[#F9F9FB] rounded-2xl px-4 py-3 text-[13px] text-[#3C3C43] mb-2">
            Creating account for <strong>{form.email}</strong>
          </div>
          <Field label="Password *" hint="At least 8 characters">
            <input
              type="password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              placeholder="••••••••"
              autoFocus
              className={inputCls}
            />
          </Field>
          <Field label="Confirm Password *">
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => update('confirmPassword', e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>
          {error && <p className="text-[13px] text-[#FF3B30]">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => { setStep('details'); setError(''); }}
              className="flex-1 h-12 rounded-2xl text-[16px] font-semibold border border-[#E5E5EA] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={nextFromAccount}
              className="flex-1 h-12 rounded-2xl text-white text-[16px] font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#007AFF' }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Motivation */}
      {step === 'motivation' && (
        <div className="space-y-4">
          <Field label="Cover Letter" hint="Optional — tell us why you're a great fit">
            <textarea
              value={form.coverLetter}
              onChange={e => update('coverLetter', e.target.value)}
              placeholder={`I am applying for the ${demandTitle} position because…`}
              rows={6}
              autoFocus
              className="w-full px-4 py-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 resize-none transition-all"
            />
          </Field>
          <div className="text-[13px] text-[#8E8E93] bg-[#F9F9FB] rounded-xl px-4 py-3">
            You can upload your CV after creating your account in your profile settings.
          </div>
          {error && <p className="text-[13px] text-[#FF3B30]">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => { setStep('account'); setError(''); }}
              className="flex-1 h-12 rounded-2xl text-[16px] font-semibold border border-[#E5E5EA] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={submit}
              disabled={isPending}
              className="flex-1 h-12 rounded-2xl text-white text-[16px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#007AFF' }}
            >
              {isPending ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
