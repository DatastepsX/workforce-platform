'use client';

import { useState, useRef, useEffect } from 'react';
import type { SupplierCandidate } from '@/types/database';

interface Props {
  action: (formData: FormData) => Promise<void>;
  returnTo?: string;
  submitLabel?: string;
  candidate?: SupplierCandidate;
}

function TagInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string[] }) {
  const [tags, setTags] = useState<string[]>(defaultValue ?? []);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const val = (e as CustomEvent<string>).detail;
      setTags(val.split(',').map(s => s.trim()).filter(Boolean));
    };
    el.addEventListener('fill-tags', handler);
    return () => el.removeEventListener('fill-tags', handler);
  }, []);

  function addTag(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) setTags(prev => [...prev, trimmed]);
    setInput('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
    else if (e.key === 'Backspace' && !input && tags.length > 0) setTags(prev => prev.slice(0, -1));
  }

  return (
    <div>
      <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">{label}</label>
      <input type="hidden" name={name} value={tags.join(',')} />
      <div className="min-h-[44px] px-3 py-2 rounded-[10px] border border-[#E5E5EA] bg-white flex flex-wrap gap-1.5 focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 transition-all">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 text-[12px] bg-[#007AFF]/10 text-[#007AFF] px-2.5 py-0.5 rounded-full font-medium">
            {tag}
            <button type="button" onClick={() => setTags(prev => prev.filter(t => t !== tag))} className="hover:opacity-70">×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          data-tag-input={name}
          data-current-value={tags.join(', ')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? 'Type and press Enter…' : ''}
          className="flex-1 min-w-[120px] outline-none text-[15px] placeholder-[#C7C7CC] bg-transparent"
        />
      </div>
    </div>
  );
}

function CvUploader({ defaultPath }: { defaultPath?: string | null }) {
  const [fileName, setFileName] = useState<string | null>(
    defaultPath ? defaultPath.split('/').pop() ?? null : null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">CV / Lebenslauf</label>
      <input type="hidden" name="cv_path" value={fileName ? (defaultPath ?? '') : ''} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-4 py-2 rounded-[10px] border border-[#E5E5EA] bg-white text-[13px] font-medium text-[#007AFF] hover:bg-[#007AFF]/5 transition-colors"
        >
          {fileName ? 'Ändern' : 'PDF hochladen'}
        </button>
        {fileName && (
          <span className="flex items-center gap-1.5 text-[13px] text-[#3C3C43]">
            <span className="w-2 h-2 rounded-full bg-[#007AFF]" />
            {fileName}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          name="cv_file"
          accept="application/pdf"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) setFileName(file.name);
          }}
        />
      </div>
    </div>
  );
}

const INPUT = 'w-full h-11 px-4 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all';
const LABEL = 'block text-[13px] font-medium text-[#3C3C43] mb-1.5';

export function CandidateForm({ action, returnTo, submitLabel = 'Save', candidate }: Props) {
  return (
    <form action={action} className="space-y-4" encType="multipart/form-data">
      {candidate && <input type="hidden" name="id" value={candidate.id} />}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

      {/* Name */}
      <div>
        <label className={LABEL}>Full Name *</label>
        <input type="text" name="name" required defaultValue={candidate?.name} placeholder="Maria Schmidt" className={INPUT} />
      </div>

      {/* Headline */}
      <div>
        <label className={LABEL}>Headline</label>
        <input type="text" name="headline" defaultValue={candidate?.headline ?? ''} placeholder="Senior SAP Consultant, 8+ years" className={INPUT} />
      </div>

      {/* Email + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Email</label>
          <input type="email" name="email" defaultValue={candidate?.email ?? ''} placeholder="maria@example.com" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Phone</label>
          <input type="tel" name="phone" defaultValue={candidate?.phone ?? ''} placeholder="+49 170 1234567" className={INPUT} />
        </div>
      </div>

      {/* Location + Availability */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Standort</label>
          <input type="text" name="location" defaultValue={candidate?.location ?? ''} placeholder="München, Deutschland" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Verfügbarkeit</label>
          <input type="text" name="availability" defaultValue={candidate?.availability ?? ''} placeholder="Sofort / ab 01.09.2026" className={INPUT} />
        </div>
      </div>

      {/* Rate */}
      <div>
        <label className={LABEL}>Tagessatz / Gehalt</label>
        <div className="flex gap-2 items-center">
          <input type="number" name="hourly_rate_min" defaultValue={candidate?.hourly_rate_min ?? ''} placeholder="Min" className="w-24 h-11 px-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all text-center" />
          <span className="text-[#8E8E93] text-[13px]">–</span>
          <input type="number" name="hourly_rate_max" defaultValue={candidate?.hourly_rate_max ?? ''} placeholder="Max" className="w-24 h-11 px-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all text-center" />
          <select name="currency" defaultValue={candidate?.currency ?? 'EUR'} className="h-11 px-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] text-[#3C3C43] focus:outline-none focus:border-[#007AFF] transition-all">
            <option value="EUR">EUR</option>
            <option value="CHF">CHF</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* Skills */}
      <TagInput name="skills" label="Skills" defaultValue={candidate?.skills} />

      {/* CV upload */}
      <CvUploader defaultPath={candidate?.cv_path} />

      {/* Notes */}
      <div>
        <label className={LABEL}>Interne Notizen</label>
        <textarea name="notes" defaultValue={candidate?.notes ?? ''} placeholder="Verfügbarkeit, Besonderheiten, Kontext…" rows={3}
          className="w-full px-4 py-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 resize-none transition-all" />
      </div>

      <button type="submit" className="w-full h-12 rounded-2xl text-white text-[16px] font-semibold mt-2 transition-opacity hover:opacity-90" style={{ backgroundColor: '#007AFF' }}>
        {submitLabel}
      </button>
    </form>
  );
}
