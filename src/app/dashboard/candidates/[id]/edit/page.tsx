'use client';

import { useEffect, useRef, useState, useTransition, KeyboardEvent } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { adminUpdateCandidateProfile } from '@/lib/actions/candidates';
import Link from 'next/link';
import type { CandidateProfile } from '@/types/database';

const INPUT = 'w-full h-11 px-4 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all';
const LABEL = 'block text-[13px] font-medium text-[#3C3C43] mb-1.5';
const TEXTAREA = 'w-full px-4 py-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 resize-none transition-all';

function TagInput({ name, label, initialTags = [], placeholder }: { name: string; label: string; initialTags?: string[]; placeholder?: string }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState('');

  function add() {
    const val = input.trim();
    if (val && !tags.includes(val)) setTags(t => [...t, val]);
    setInput('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !input && tags.length > 0) setTags(t => t.slice(0, -1));
  }

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input type="hidden" name={name} value={tags.join(',')} />
      <div className="min-h-[44px] px-3 py-2 rounded-[10px] border border-[#E5E5EA] bg-white focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 flex flex-wrap gap-1.5 items-center transition-all">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#007AFF]/10 text-[#007AFF] rounded-full text-[12px] font-medium">
            {t}
            <button type="button" onClick={() => setTags(ts => ts.filter(x => x !== t))} className="ml-0.5 text-[#007AFF]/60 hover:text-[#FF3B30] transition-colors leading-none">×</button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] text-[14px] bg-transparent outline-none placeholder-[#C7C7CC]"
        />
      </div>
    </div>
  );
}

export default function CandidateEditPage() {
  const { id } = useParams<{ id: string }>();
  const [cp, setCp] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('candidate_profiles').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { setError('Candidate not found'); }
      else { setCp(data as CandidateProfile); }
      setLoading(false);
    });
  }, [id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startTransition(async () => {
      const result = await adminUpdateCandidateProfile(id, fd);
      if (result?.error) setError(result.error);
    });
  }

  if (loading) return (
    <div className="px-8 py-10">
      <div className="h-8 w-48 bg-[#F2F2F7] rounded-lg animate-pulse mb-6" />
      <div className="space-y-4">
        {[1,2,3,4].map(i => <div key={i} className="h-11 bg-[#F2F2F7] rounded-[10px] animate-pulse" />)}
      </div>
    </div>
  );

  if (!cp) return (
    <div className="px-8 py-10 text-center">
      <p className="text-[#FF3B30]">{error ?? 'Candidate not found'}</p>
      <Link href="/dashboard/candidates" className="mt-4 inline-block text-[#007AFF] text-[14px]">← Back to Candidates</Link>
    </div>
  );

  const displayName = cp.full_name || `Candidate ${id.slice(0, 8)}`;

  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="flex items-center gap-2 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/candidates" className="hover:text-[#007AFF] transition-colors">Candidates</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <Link href={`/dashboard/candidates/${id}`} className="hover:text-[#007AFF] transition-colors">{displayName}</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <span className="text-black font-medium">Edit</span>
      </div>

      <h1 className="text-[28px] font-bold tracking-tight text-black mb-6">Edit Candidate Profile</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-[10px] bg-[#FF3B30]/10 text-[#FF3B30] text-[14px]">{error}</div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Basic Info</p>
          <div>
            <label className={LABEL}>Full Name</label>
            <input name="full_name" type="text" defaultValue={cp.full_name ?? ''} className={INPUT} placeholder="Full Name" />
          </div>
          <div>
            <label className={LABEL}>Headline</label>
            <input name="headline" type="text" defaultValue={cp.headline ?? ''} className={INPUT} placeholder="e.g. Senior Software Engineer" />
          </div>
          <div>
            <label className={LABEL}>Bio / Summary</label>
            <textarea name="bio" rows={4} defaultValue={cp.bio ?? ''} className={TEXTAREA} placeholder="Professional summary…" />
          </div>
        </div>

        {/* Skills */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Skills & Languages</p>
          <TagInput name="skills" label="Skills" initialTags={cp.skills ?? []} placeholder="Type skill + Enter" />
          <TagInput name="languages" label="Languages" initialTags={cp.languages ?? []} placeholder="e.g. English, German" />
        </div>

        {/* Experience */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Experience</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Years of Experience</label>
              <input name="years_experience" type="number" min="0" max="50" defaultValue={cp.years_experience ?? ''} className={INPUT} placeholder="0" />
            </div>
            <div>
              <label className={LABEL}>Seniority Level</label>
              <select name="seniority_level" defaultValue={cp.seniority_level ?? ''} className={INPUT}>
                <option value="">— select —</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>Location</label>
            <input name="location" type="text" defaultValue={cp.location ?? ''} className={INPUT} placeholder="City, Country" />
          </div>
          <div>
            <label className={LABEL}>Remote Preference</label>
            <select name="remote_preference" defaultValue={cp.remote_preference} className={INPUT}>
              <option value="onsite">On-site</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Full Remote</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>
        </div>

        {/* Availability */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Availability</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Availability Status</label>
              <select name="availability_type" defaultValue={cp.availability_type} className={INPUT}>
                <option value="immediate">Available Now</option>
                <option value="notice_period">Notice Period</option>
                <option value="not_available">Not Available</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Notice Period (weeks)</label>
              <input name="notice_period_weeks" type="number" min="0" max="52" defaultValue={cp.notice_period_weeks ?? ''} className={INPUT} placeholder="0" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Available From</label>
            <input name="availability_date" type="date" defaultValue={cp.availability_date ?? ''} className={INPUT} />
          </div>
        </div>

        {/* Rates */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Rates</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Rate Min</label>
              <input name="hourly_rate_min" type="number" min="0" defaultValue={cp.hourly_rate_min ?? ''} className={INPUT} placeholder="60" />
            </div>
            <div>
              <label className={LABEL}>Rate Max</label>
              <input name="hourly_rate_max" type="number" min="0" defaultValue={cp.hourly_rate_max ?? ''} className={INPUT} placeholder="120" />
            </div>
            <div>
              <label className={LABEL}>Currency</label>
              <select name="currency" defaultValue={cp.currency ?? 'EUR'} className={INPUT}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Links</p>
          <div>
            <label className={LABEL}>LinkedIn URL</label>
            <input name="linkedin_url" type="url" defaultValue={cp.linkedin_url ?? ''} className={INPUT} placeholder="https://linkedin.com/in/…" />
          </div>
          <div>
            <label className={LABEL}>Portfolio URL</label>
            <input name="portfolio_url" type="url" defaultValue={cp.portfolio_url ?? ''} className={INPUT} placeholder="https://…" />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="h-11 px-6 rounded-2xl text-white text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#007AFF' }}
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <Link
            href={`/dashboard/candidates/${id}`}
            className="h-11 px-6 rounded-2xl border border-[#E5E5EA] text-[14px] font-medium text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors flex items-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
