'use client';

import { useState, useRef, useEffect, useTransition, KeyboardEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { upsertCandidateProfile } from '@/lib/actions/candidates';
import type { CandidateProfile, AvailabilityType, RemotePreference } from '@/types/database';

// ── CV generation (dynamic import to avoid SSR issues) ───────────────────────

async function buildAndUploadCv(d: {
  userId: string; userName: string; userEmail: string;
  headline: string; bio: string; skills: string[];
  yearsExp: string; seniority: string; availability: string;
  location: string; remotePref: string; languages: string[];
  rateMin: string; rateMax: string; currency: string;
  linkedin: string; portfolio: string; prefEmp: string[];
}): Promise<{ path: string; signedUrl: string | null }> {
  const { pdf, Document, Page, Text, View, StyleSheet } =
    await import('@react-pdf/renderer');

  const s = StyleSheet.create({
    page:         { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#1A1A1A', lineHeight: 1.5 },
    name:         { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
    headlineTxt:  { fontSize: 12, color: '#555555', marginBottom: 10 },
    contactRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18, color: '#555555', fontSize: 9 },
    divider:      { borderBottomWidth: 0.5, borderBottomColor: '#DDDDDD', marginBottom: 14 },
    sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#007AFF', letterSpacing: 0.6, marginBottom: 5, textTransform: 'uppercase' },
    body:         { fontSize: 10, color: '#333333', lineHeight: 1.6, marginBottom: 10 },
    tagRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
    tag:          { backgroundColor: '#EBF3FF', color: '#007AFF', fontSize: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
    detailRow:    { flexDirection: 'row', gap: 24, marginBottom: 4 },
    detailLabel:  { fontSize: 9, color: '#888888' },
    detailValue:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1A1A1A' },
    section:      { marginBottom: 14 },
  });

  const seniorityLabel: Record<string, string> = { junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead' };
  const remoteLabel:    Record<string, string>  = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Full remote', flexible: 'Flexible' };
  const availLabel:     Record<string, string>  = { immediate: 'Immediately available', notice_period: 'Notice period', not_available: 'Not available' };
  const displayName = d.userName || d.userEmail;

  const doc = (
    <Document title={`${displayName} – CV`} author={displayName}>
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{displayName}</Text>
        {!!d.headline && <Text style={s.headlineTxt}>{d.headline}</Text>}
        <View style={s.contactRow}>
          {!!d.location  && <Text>{d.location}</Text>}
          {!!d.userEmail && <Text>·  {d.userEmail}</Text>}
          {!!d.linkedin  && <Text>·  {d.linkedin}</Text>}
          {!!d.portfolio && <Text>·  {d.portfolio}</Text>}
        </View>
        <View style={s.divider} />

        {!!d.bio && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Professional Summary</Text>
            <Text style={s.body}>{d.bio}</Text>
          </View>
        )}

        {d.skills.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Skills</Text>
            <View style={s.tagRow}>
              {d.skills.map((sk, i) => <View key={i} style={s.tag}><Text>{sk}</Text></View>)}
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Details</Text>
          <View style={s.detailRow}>
            {!!d.yearsExp     && <View><Text style={s.detailLabel}>Experience</Text><Text style={s.detailValue}>{d.yearsExp} years</Text></View>}
            {!!d.seniority    && <View><Text style={s.detailLabel}>Seniority</Text><Text style={s.detailValue}>{seniorityLabel[d.seniority] ?? d.seniority}</Text></View>}
            {!!d.availability && <View><Text style={s.detailLabel}>Availability</Text><Text style={s.detailValue}>{availLabel[d.availability] ?? d.availability}</Text></View>}
            {!!d.remotePref   && <View><Text style={s.detailLabel}>Remote</Text><Text style={s.detailValue}>{remoteLabel[d.remotePref] ?? d.remotePref}</Text></View>}
          </View>
        </View>

        {d.languages.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Languages</Text>
            <Text style={s.body}>{d.languages.join('  ·  ')}</Text>
          </View>
        )}

        {d.prefEmp.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Employment Preferences</Text>
            <Text style={s.body}>{d.prefEmp.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join('  ·  ')}</Text>
          </View>
        )}

        {(!!d.rateMin || !!d.rateMax) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Rate</Text>
            <Text style={s.body}>
              {d.currency}{' '}
              {d.rateMin && d.rateMax
                ? `${d.rateMin} – ${d.rateMax} / hr`
                : d.rateMin ? `from ${d.rateMin} / hr` : `up to ${d.rateMax} / hr`}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const supabase = createClient();
  const path = `${d.userId}/cv.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('cvs')
    .upload(path, blob, { upsert: true, contentType: 'application/pdf' });
  if (uploadErr) throw new Error(uploadErr.message);
  const { data: urlData } = await supabase.storage.from('cvs').createSignedUrl(path, 3600);
  return { path, signedUrl: urlData?.signedUrl ?? null };
}

// ── Completion ────────────────────────────────────────────────────────────────

function calcCompletion(s: {
  headline: string; bio: string; skills: string[]; yearsExp: string;
  seniority: string; availability: string; location: string;
  languages: string[]; linkedIn: string; cvPath: string | null;
}) {
  const checks = [
    !!s.headline, !!s.bio, s.skills.length > 0, !!s.yearsExp, !!s.seniority,
    s.availability !== 'not_available', !!s.location,
    s.languages.length > 0, !!s.linkedIn, !!s.cvPath,
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

const AVAIL_COLORS: Record<AvailabilityType, string> = {
  immediate:      '#34C759',
  notice_period:  '#FF9500',
  not_available:  '#FF3B30',
};
const AVAIL_LABELS: Record<AvailabilityType, string> = {
  immediate:      'Immediately available',
  notice_period:  'Notice period',
  not_available:  'Not available',
};

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder, name }: {
  tags: string[]; onChange: (t: string[]) => void; placeholder?: string; name?: string;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!name) return;
    const el = inputRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const val = (e as CustomEvent<string>).detail;
      onChange(val.split(',').map(s => s.trim()).filter(Boolean));
    };
    el.addEventListener('fill-tags', handler);
    return () => el.removeEventListener('fill-tags', handler);
  }, [name, onChange]);

  function add() {
    const tag = input.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="bg-[#F2F2F7] rounded-xl px-3 py-2 border-[1.5px] border-transparent focus-within:border-[#007AFF] focus-within:bg-white transition-colors">
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 text-[13px] bg-[#007AFF]/10 text-[#007AFF] px-2.5 py-0.5 rounded-full font-medium">
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter(t => t !== tag))}
              className="text-[#007AFF]/60 hover:text-[#007AFF] ml-0.5 leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        {...(name ? { 'data-tag-input': name, 'data-current-value': tags.join(', ') } : {})}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : 'Add more…'}
        className="w-full bg-transparent text-[15px] text-black placeholder:text-[#8E8E93] outline-none"
      />
    </div>
  );
}

// ── CV uploader ───────────────────────────────────────────────────────────────

function CVUploader({ userId, cvPath, signedUrl, onUploaded }: {
  userId: string;
  cvPath: string | null;
  signedUrl: string | null;
  onUploaded: (path: string, signedUrl: string | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasCV = !!cvPath;

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') { setError('Only PDF files are accepted'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10 MB'); return; }

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${userId}/cv.pdf`;
    const { error: err } = await supabase.storage
      .from('cvs')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' });

    if (err) {
      setError(err.message);
    } else {
      const { data } = await supabase.storage.from('cvs').createSignedUrl(path, 3600);
      onUploaded(path, data?.signedUrl ?? null);
    }
    setUploading(false);
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files[0]; if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          'rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all',
          dragging    ? 'border-[#007AFF] bg-[#007AFF]/5 scale-[1.01]' :
          hasCV       ? 'border-[#34C759] bg-[#34C759]/5' :
                        'border-[#C6C6C8] hover:border-[#007AFF] hover:bg-[#007AFF]/3',
        ].join(' ')}
      >
        <input ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 animate-spin text-[#007AFF]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(0,122,255,0.2)" strokeWidth="3" />
              <path d="M4 12a8 8 0 018-8" stroke="#007AFF" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p className="text-[14px] text-[#007AFF] font-medium">Uploading…</p>
          </div>
        ) : hasCV ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#34C759]/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#34C759]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-[#34C759]">CV uploaded</p>
            {signedUrl && (
              <a href={signedUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[13px] text-[#007AFF] underline">
                Download / Preview
              </a>
            )}
            <p className="text-[12px] text-[#8E8E93] mt-1">Drop a new PDF to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#F2F2F7] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-black">Drop your CV here</p>
            <p className="text-[13px] text-[#8E8E93]">PDF only · max 10 MB</p>
          </div>
        )}
      </div>
      {error && <p className="text-[13px] text-[#FF3B30] mt-2">{error}</p>}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-[#F2F2F7] rounded-xl px-4 py-3.5 text-[15px] text-black placeholder:text-[#8E8E93] outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
      <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-[#3C3C43]">{label}</label>
      {children}
    </div>
  );
}

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
  initialProfile: CandidateProfile | null;
  initialCvSignedUrl: string | null;
}

export function ProfileForm({ userId, userName, userEmail, initialProfile: p, initialCvSignedUrl }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const [fillSuccess, setFillSuccess] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);

  // Form state
  const [headline,     setHeadline]     = useState(p?.headline ?? '');
  const [bio,          setBio]          = useState(p?.bio ?? '');
  const [skills,       setSkills]       = useState<string[]>(p?.skills ?? []);
  const [yearsExp,     setYearsExp]     = useState(String(p?.years_experience ?? ''));
  const [seniority,    setSeniority]    = useState(p?.seniority_level ?? '');
  const [availability, setAvailability] = useState<AvailabilityType>(p?.availability_type ?? 'not_available');
  const [availDate,    setAvailDate]    = useState(p?.availability_date ?? '');
  const [noticePeriod, setNoticePeriod] = useState(String(p?.notice_period_weeks ?? ''));
  const [location,     setLocation]     = useState(p?.location ?? '');
  const [remotePref,   setRemotePref]   = useState<RemotePreference>(p?.remote_preference ?? 'flexible');
  const [languages,    setLanguages]    = useState<string[]>(p?.languages ?? []);
  const [rateMin,      setRateMin]      = useState(String(p?.hourly_rate_min ?? ''));
  const [rateMax,      setRateMax]      = useState(String(p?.hourly_rate_max ?? ''));
  const [currency,     setCurrency]     = useState(p?.currency ?? 'EUR');
  const [linkedin,     setLinkedin]     = useState(p?.linkedin_url ?? '');
  const [portfolio,    setPortfolio]    = useState(p?.portfolio_url ?? '');
  const [prefEmp,      setPrefEmp]      = useState<string[]>(p?.preferred_employment ?? []);
  const [cvPath,       setCvPath]       = useState<string | null>(p?.cv_path ?? null);
  const [cvSignedUrl,  setCvSignedUrl]  = useState<string | null>(initialCvSignedUrl);

  const completion = calcCompletion({ headline, bio, skills, yearsExp, seniority, availability, location, languages, linkedIn: linkedin, cvPath });

  const VALID_EMP = ['permanent', 'freelance', 'contractor', 'internship'] as const;

  async function fillWithAI() {
    setIsFilling(true);
    setFillError(null);
    setFillSuccess(false);
    try {
      const res = await fetch('/api/generate-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/dashboard/profile',
          fields: [
            { name: 'headline',           type: 'text',     label: 'Professional Headline', placeholder: 'Senior Data Engineer · 8 years in Python & Spark' },
            { name: 'bio',                type: 'textarea', label: 'Professional Bio / Summary' },
            { name: 'skills',             type: 'tags',     label: 'Technical & Professional Skills' },
            { name: 'years_experience',   type: 'number',   label: 'Years of Experience' },
            { name: 'seniority_level',    type: 'select',   label: 'Seniority Level',       options: [{ value: 'junior', label: 'Junior' }, { value: 'mid', label: 'Mid' }, { value: 'senior', label: 'Senior' }, { value: 'lead', label: 'Lead' }] },
            { name: 'availability_type',  type: 'select',   label: 'Availability Status',   options: [{ value: 'immediate', label: 'Immediately available' }, { value: 'notice_period', label: 'Notice period' }] },
            { name: 'notice_period_weeks',type: 'number',   label: 'Notice Period (weeks)' },
            { name: 'location',           type: 'text',     label: 'Location',              placeholder: 'München, Germany' },
            { name: 'remote_preference',  type: 'select',   label: 'Remote Preference',     options: [{ value: 'onsite', label: 'On-site only' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'remote', label: 'Full remote' }, { value: 'flexible', label: 'Flexible' }] },
            { name: 'languages',          type: 'tags',     label: 'Spoken Languages' },
            { name: 'hourly_rate_min',    type: 'number',   label: 'Minimum Hourly Rate (EUR)' },
            { name: 'hourly_rate_max',    type: 'number',   label: 'Maximum Hourly Rate (EUR)' },
            { name: 'currency',           type: 'select',   label: 'Currency',              options: [{ value: 'EUR', label: 'EUR €' }, { value: 'CHF', label: 'CHF ₣' }, { value: 'GBP', label: 'GBP £' }, { value: 'USD', label: 'USD $' }] },
            { name: 'linkedin_url',       type: 'url',      label: 'LinkedIn URL' },
            { name: 'portfolio_url',      type: 'url',      label: 'Portfolio / Website URL' },
            { name: 'preferred_employment', type: 'tags',   label: 'Preferred Employment Types', placeholder: 'permanent, freelance, contractor, internship' },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as Record<string, string>;

      const newHeadline  = data.headline            || headline;
      const newBio       = data.bio                 || bio;
      const newSkills    = data.skills ? data.skills.split(',').map(s => s.trim()).filter(Boolean) : skills;
      const newYearsExp  = data.years_experience    || yearsExp;
      const newSeniority = data.seniority_level     || seniority;
      const newAvail     = (data.availability_type as AvailabilityType) || availability;
      const newNotice    = data.notice_period_weeks || noticePeriod;
      const newLocation  = data.location            || location;
      const newRemote    = (data.remote_preference as RemotePreference) || remotePref;
      const newLanguages = data.languages ? data.languages.split(',').map(s => s.trim()).filter(Boolean) : languages;
      const newRateMin   = data.hourly_rate_min     || rateMin;
      const newRateMax   = data.hourly_rate_max     || rateMax;
      const newCurrency  = data.currency            || currency;
      const newLinkedin  = data.linkedin_url        || linkedin;
      const newPortfolio = data.portfolio_url       || portfolio;
      const newPrefEmp   = data.preferred_employment
        ? data.preferred_employment.split(',').map(s => s.trim().toLowerCase()).filter(s => (VALID_EMP as readonly string[]).includes(s))
        : prefEmp;

      setHeadline(newHeadline);
      setBio(newBio);
      setSkills(newSkills);
      setYearsExp(newYearsExp);
      setSeniority(newSeniority);
      setAvailability(newAvail);
      if (newNotice) setNoticePeriod(newNotice);
      setLocation(newLocation);
      setRemotePref(newRemote);
      setLanguages(newLanguages);
      setRateMin(newRateMin);
      setRateMax(newRateMax);
      setCurrency(newCurrency);
      setLinkedin(newLinkedin);
      setPortfolio(newPortfolio);
      if (newPrefEmp.length > 0) setPrefEmp(newPrefEmp);

      // Generate and upload CV PDF automatically
      const { path, signedUrl } = await buildAndUploadCv({
        userId, userName, userEmail,
        headline: newHeadline, bio: newBio, skills: newSkills,
        yearsExp: newYearsExp, seniority: newSeniority, availability: newAvail,
        location: newLocation, remotePref: newRemote, languages: newLanguages,
        rateMin: newRateMin, rateMax: newRateMax, currency: newCurrency,
        linkedin: newLinkedin, portfolio: newPortfolio, prefEmp: newPrefEmp,
      });
      setCvPath(path);
      setCvSignedUrl(signedUrl);

      setFillSuccess(true);
      setTimeout(() => setFillSuccess(false), 4000);
    } catch (e) {
      setFillError(e instanceof Error ? e.message : 'AI fill failed');
    } finally {
      setIsFilling(false);
    }
  }

  const barColor =
    completion >= 100 ? '#34C759' :
    completion >= 70  ? '#007AFF' :
    completion >= 40  ? '#FF9500' : '#FF3B30';

  function togglePrefEmp(val: string) {
    setPrefEmp(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }

  async function handleSubmit() {
    const fd = new FormData();
    fd.set('headline',            headline);
    fd.set('bio',                 bio);
    fd.set('skills',              skills.join(','));
    fd.set('years_experience',    yearsExp);
    fd.set('seniority_level',     seniority);
    fd.set('availability_type',   availability);
    fd.set('availability_date',   availDate);
    fd.set('notice_period_weeks', noticePeriod);
    fd.set('location',            location);
    fd.set('remote_preference',   remotePref);
    fd.set('languages',           languages.join(','));
    fd.set('hourly_rate_min',     rateMin);
    fd.set('hourly_rate_max',     rateMax);
    fd.set('currency',            currency);
    fd.set('linkedin_url',        linkedin);
    fd.set('portfolio_url',       portfolio);
    fd.set('preferred_employment', prefEmp.join(','));
    fd.set('cv_path',             cvPath ?? '');

    setSaveError(null);
    startTransition(async () => {
      const result = await upsertCandidateProfile(fd);
      if (result?.error) {
        setSaveError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Completion bar */}
      <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-black">Profile completion</p>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-bold" style={{ color: barColor }}>{completion}%</span>
            <button
              type="button"
              onClick={fillWithAI}
              disabled={isFilling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait"
              style={{
                color: fillSuccess ? '#34C759' : '#007AFF',
                backgroundColor: fillSuccess ? 'rgba(52,199,89,0.1)' : 'rgba(0,122,255,0.08)',
              }}
            >
              {isFilling ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : fillSuccess ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                </svg>
              )}
              {isFilling ? 'Generating…' : fillSuccess ? 'Profile + CV ready!' : 'Fill with AI'}
            </button>
          </div>
        </div>
        <div className="h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${completion}%`, backgroundColor: barColor }}
          />
        </div>
        {fillError && <p className="text-[12px] text-[#FF3B30] mt-2">{fillError}</p>}
        {isFilling && <p className="text-[12px] text-[#007AFF] mt-2">Generating profile data and CV with AI…</p>}
        {!fillError && !isFilling && completion < 100 && (
          <p className="text-[12px] text-[#8E8E93] mt-2">
            {completion < 40
              ? 'Complete your profile to be discovered by recruiters.'
              : completion < 70
              ? 'Good start — add more details to stand out.'
              : 'Almost there — upload your CV to reach 100%.'}
          </p>
        )}

        {/* Availability badge */}
        <div className="mt-3 inline-flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: AVAIL_COLORS[availability] }}
          />
          <span className="text-[13px] font-medium" style={{ color: AVAIL_COLORS[availability] }}>
            {AVAIL_LABELS[availability]}
          </span>
        </div>
      </div>

      {/* Summary */}
      <Section label="Professional Summary">
        <Field label="Headline">
          <input name="headline" value={headline} onChange={e => setHeadline(e.target.value)}
            placeholder="e.g. Senior Data Engineer · 8 years in Python & Spark"
            className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seniority Level">
            <select name="seniority_level" value={seniority} onChange={e => setSeniority(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
          </Field>
          <Field label="Years of Experience">
            <input name="years_experience" type="number" min="0" max="50" value={yearsExp}
              onChange={e => setYearsExp(e.target.value)}
              placeholder="e.g. 8" className={inputCls} />
          </Field>
        </div>
        <Field label="Bio">
          <textarea name="bio" value={bio} onChange={e => setBio(e.target.value)} rows={4}
            placeholder="Short professional introduction — what you do, what you're looking for…"
            className={inputCls + ' resize-none'} />
        </Field>
      </Section>

      {/* Skills */}
      <Section label="Skills">
        <Field label="Technical & Professional Skills">
          <TagInput tags={skills} onChange={setSkills} name="skills"
            placeholder="Type a skill and press Enter (e.g. Python, SQL, AWS…)" />
        </Field>
      </Section>

      {/* Availability */}
      <Section label="Availability">
        <Field label="Status">
          <select name="availability_type" value={availability}
            onChange={e => setAvailability(e.target.value as AvailabilityType)}
            className={inputCls}>
            <option value="immediate">Immediately available</option>
            <option value="notice_period">Notice period</option>
            <option value="not_available">Not available</option>
          </select>
        </Field>
        {availability === 'notice_period' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Notice Period (weeks)">
              <input name="notice_period_weeks" type="number" min="1" max="52" value={noticePeriod}
                onChange={e => setNoticePeriod(e.target.value)}
                placeholder="e.g. 4" className={inputCls} />
            </Field>
            <Field label="Available from">
              <input name="availability_date" type="date" value={availDate}
                onChange={e => setAvailDate(e.target.value)}
                className={inputCls} />
            </Field>
          </div>
        )}
        {availability === 'immediate' && (
          <Field label="Available from (optional)">
            <input name="availability_date" type="date" value={availDate}
              onChange={e => setAvailDate(e.target.value)}
              className={inputCls} />
          </Field>
        )}
      </Section>

      {/* Work Preferences */}
      <Section label="Work Preferences">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <input name="location" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="e.g. München, Germany" className={inputCls} />
          </Field>
          <Field label="Remote Preference">
            <select name="remote_preference" value={remotePref}
              onChange={e => setRemotePref(e.target.value as RemotePreference)}
              className={inputCls}>
              <option value="onsite">On-site only</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Full remote</option>
              <option value="flexible">Flexible</option>
            </select>
          </Field>
        </div>
        <Field label="Preferred Employment Type">
          <div className="flex flex-wrap gap-2 pt-1">
            {(['permanent', 'freelance', 'contractor', 'internship'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => togglePrefEmp(type)}
                className={`px-3.5 py-2 rounded-xl text-[13px] font-medium border-[1.5px] transition-colors capitalize ${
                  prefEmp.includes(type)
                    ? 'border-[#007AFF] bg-[#007AFF]/8 text-[#007AFF]'
                    : 'border-[#E5E5EA] bg-white text-[#3C3C43] hover:border-[#007AFF]/40'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* Compensation */}
      <Section label="Rate / Compensation">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Min (hourly)">
            <input name="hourly_rate_min" type="number" min="0" value={rateMin}
              onChange={e => setRateMin(e.target.value)}
              placeholder="0" className={inputCls} />
          </Field>
          <Field label="Max (hourly)">
            <input name="hourly_rate_max" type="number" min="0" value={rateMax}
              onChange={e => setRateMax(e.target.value)}
              placeholder="0" className={inputCls} />
          </Field>
          <Field label="Currency">
            <select name="currency" value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
              <option value="EUR">EUR €</option>
              <option value="CHF">CHF ₣</option>
              <option value="GBP">GBP £</option>
              <option value="USD">USD $</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Languages */}
      <Section label="Languages">
        <Field label="Spoken Languages">
          <TagInput tags={languages} onChange={setLanguages} name="languages"
            placeholder="Type a language and press Enter (e.g. German, English…)" />
        </Field>
      </Section>

      {/* Links */}
      <Section label="Online Presence">
        <Field label="LinkedIn URL">
          <input name="linkedin_url" type="url" value={linkedin} onChange={e => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/in/yourname" className={inputCls} />
        </Field>
        <Field label="Portfolio / Website">
          <input name="portfolio_url" type="url" value={portfolio} onChange={e => setPortfolio(e.target.value)}
            placeholder="https://yoursite.com" className={inputCls} />
        </Field>
      </Section>

      {/* CV */}
      <Section label="CV / Resume">
        <CVUploader
          userId={userId}
          cvPath={cvPath}
          signedUrl={cvSignedUrl}
          onUploaded={(path, url) => { setCvPath(path); setCvSignedUrl(url); }}
        />
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1 pb-10">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="px-6 py-3 rounded-[12px] text-white text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.28)' }}
        >
          {isPending ? 'Saving…' : 'Save Profile'}
        </button>
        {saved && (
          <span className="text-[14px] font-medium text-[#34C759] flex items-center gap-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved!
          </span>
        )}
        {saveError && <span className="text-[14px] text-[#FF3B30]">{saveError}</span>}
      </div>
    </div>
  );
}
