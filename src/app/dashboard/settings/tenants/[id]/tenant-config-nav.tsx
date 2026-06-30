'use client';

import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'section-details',    label: 'Details'     },
  { id: 'section-workflow',   label: 'Workflow'    },
  { id: 'section-roles',      label: 'Roles'       },
  { id: 'section-suppliers',  label: 'Suppliers'   },
  { id: 'section-org',        label: 'Org & JDs'  },
  { id: 'section-compliance', label: 'Compliance'  },
  { id: 'section-users',      label: 'Users'       },
];

export function TenantConfigNav() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 },
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-[#E5E5EA] -mx-8 px-8 mb-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex gap-0.5 overflow-x-auto scrollbar-none py-1">
        {SECTIONS.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={() => setActive(s.id)}
            className="flex-shrink-0 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap"
            style={{
              color: active === s.id ? '#007AFF' : '#8E8E93',
              backgroundColor: active === s.id ? '#E8F4FD' : 'transparent',
            }}
          >
            {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}
