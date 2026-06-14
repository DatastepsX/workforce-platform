'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

interface FieldInfo {
  name: string;
  type: string;
  label: string;
  placeholder: string;
  options?: { value: string; label: string }[];
}

function findLabel(el: Element): string {
  const clean = (e: Element) =>
    e.textContent?.trim().replace(/\s*\*\s*$/, '').trim() ?? '';

  // 1. Explicit label[for]
  if (el.id) {
    const lbl = document.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
    if (lbl) return clean(lbl);
  }

  // 2. aria-label
  const aria = el.getAttribute('aria-label');
  if (aria) return aria;

  // 3. Input wrapped inside a <label>
  const insideLabel = el.closest('label');
  if (insideLabel) return clean(insideLabel);

  // 4. Sibling label in same parent div (WorkforceX Field component pattern)
  const parentLabel = el.parentElement?.querySelector('label');
  if (parentLabel && !parentLabel.contains(el)) return clean(parentLabel);

  // 5. Label in grandparent (handles grid wrappers)
  const gpLabel = el.parentElement?.parentElement?.querySelector('label');
  if (gpLabel && !gpLabel.contains(el)) return clean(gpLabel);

  return '';
}

function scanFields(): FieldInfo[] {
  const fields: FieldInfo[] = [];
  const seen = new Set<string>();

  const elements = document.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]), select, textarea',
  );

  elements.forEach(el => {
    const key = el.name || el.id;
    if (!key || seen.has(key)) return;
    seen.add(key);

    const field: FieldInfo = {
      name: key,
      type:
        el instanceof HTMLSelectElement
          ? 'select'
          : el instanceof HTMLTextAreaElement
          ? 'textarea'
          : (el as HTMLInputElement).type || 'text',
      label: findLabel(el),
      placeholder: (el as HTMLInputElement).placeholder ?? '',
    };

    if (el instanceof HTMLSelectElement) {
      field.options = Array.from(el.options)
        .filter(o => o.value !== '')
        .map(o => ({ value: o.value, label: o.textContent?.trim() ?? o.value }));
    }

    fields.push(field);
  });

  return fields;
}

function fillFields(data: Record<string, string>) {
  const inputSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set!;
  const textareaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )!.set!;
  const selectSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    'value',
  )!.set!;

  const elements = document.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]), select, textarea',
  );

  elements.forEach(el => {
    const key = el.name || el.id;
    const value = data[key];
    if (value === undefined || value === null) return;

    if (el instanceof HTMLSelectElement) {
      selectSetter.call(el, value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el instanceof HTMLTextAreaElement) {
      textareaSetter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.type === 'checkbox') {
      el.checked = value === 'true' || value === '1' || value === 'yes';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      inputSetter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

type State = 'idle' | 'loading' | 'success' | 'error';

export function DevDataGenerator() {
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const pathname = usePathname();

  async function generate() {
    setState('loading');
    setErrorMsg('');

    try {
      const fields = scanFields();

      if (!fields.length) {
        setErrorMsg('No form fields found on this page');
        setState('error');
        setTimeout(() => setState('idle'), 3000);
        return;
      }

      const res = await fetch('/api/generate-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname, fields }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as Record<string, string>;
      fillFields(data);
      setState('success');
      setTimeout(() => setState('idle'), 2000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to generate data');
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {/* Error toast */}
      {state === 'error' && (
        <div className="pointer-events-auto bg-[#1C1C1E] text-white text-[12px] font-medium px-3.5 py-2 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] max-w-[220px] leading-relaxed">
          <span className="text-[#FF3B30] mr-1">✕</span>
          {errorMsg}
        </div>
      )}

      {/* Success toast */}
      {state === 'success' && (
        <div className="pointer-events-auto bg-[#1C1C1E] text-white text-[12px] font-medium px-3.5 py-2 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <span className="text-[#34C759] mr-1">✓</span>
          Fields filled!
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={generate}
        disabled={state === 'loading'}
        title="Generate test data with AI"
        className="pointer-events-auto group relative w-14 h-14 rounded-full flex items-center justify-center text-white transition-all duration-200 active:scale-95 disabled:cursor-not-allowed"
        style={{
          backgroundColor: state === 'error' ? '#FF3B30' : state === 'success' ? '#34C759' : '#007AFF',
          boxShadow: '0 4px 20px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.12)',
        }}
      >
        {state === 'loading' ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
            <path d="M4 12a8 8 0 018-8" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : state === 'success' ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : state === 'error' ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-[22px] leading-none select-none">✨</span>
        )}

        {/* Tooltip */}
        <span className="absolute right-16 bg-[#1C1C1E] text-white text-[11px] font-medium px-2.5 py-1.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-lg">
          Generate test data
        </span>
      </button>
    </div>
  );
}
