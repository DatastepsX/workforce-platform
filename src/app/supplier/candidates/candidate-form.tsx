'use client';

import { useState, useRef, useEffect } from 'react';
import type { SupplierCandidate } from '@/types/database';

interface Props {
  action: (formData: FormData) => Promise<void>;
  returnTo?: string;
  submitLabel?: string;
  candidate?: SupplierCandidate;
}

function TagInput({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string[];
}) {
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
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setInput('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
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

export function CandidateForm({ action, returnTo, submitLabel = 'Save', candidate }: Props) {
  return (
    <form action={action} className="space-y-4">
      {candidate && <input type="hidden" name="id" value={candidate.id} />}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

      {/* Name */}
      <div>
        <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Full Name *</label>
        <input
          type="text"
          name="name"
          required
          defaultValue={candidate?.name}
          placeholder="Maria Schmidt"
          className="w-full h-11 px-4 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
        />
      </div>

      {/* Headline */}
      <div>
        <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Headline</label>
        <input
          type="text"
          name="headline"
          defaultValue={candidate?.headline ?? ''}
          placeholder="Senior SAP Consultant, 8+ years"
          className="w-full h-11 px-4 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
        />
      </div>

      {/* Email + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Email</label>
          <input
            type="email"
            name="email"
            defaultValue={candidate?.email ?? ''}
            placeholder="maria@example.com"
            className="w-full h-11 px-4 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Phone</label>
          <input
            type="tel"
            name="phone"
            defaultValue={candidate?.phone ?? ''}
            placeholder="+49 170 1234567"
            className="w-full h-11 px-4 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
          />
        </div>
      </div>

      {/* Skills */}
      <TagInput name="skills" label="Skills" defaultValue={candidate?.skills} />

      {/* CV path (hidden — could be wired to uploader later) */}
      <input type="hidden" name="cv_path" value={candidate?.cv_path ?? ''} />

      {/* Notes */}
      <div>
        <label className="block text-[13px] font-medium text-[#3C3C43] mb-1.5">Internal Notes</label>
        <textarea
          name="notes"
          defaultValue={candidate?.notes ?? ''}
          placeholder="Rate expectations, availability, other context…"
          rows={3}
          className="w-full px-4 py-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 resize-none transition-all"
        />
      </div>

      <button
        type="submit"
        className="w-full h-12 rounded-2xl text-white text-[16px] font-semibold mt-2 transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#007AFF' }}
      >
        {submitLabel}
      </button>
    </form>
  );
}
