'use client';

import { useTransition } from 'react';
import { markDemandNotificationUnread } from '@/lib/actions/notifications';
import { useRouter } from 'next/navigation';

export function MarkDemandUnreadButton({ demandId }: { demandId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handle() {
    startTransition(async () => {
      await markDemandNotificationUnread(demandId);
      router.push('/dashboard/demands');
    });
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title="Als ungelesen markieren"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium text-[#8E8E93] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors disabled:opacity-40"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <path d="M12 5v2M12 17v2M5 12H3M21 12h-2M7.05 7.05l-1.41-1.41M18.36 18.36l-1.41-1.41M7.05 16.95l-1.41 1.41M18.36 5.64l-1.41 1.41" />
      </svg>
      Ungelesen
    </button>
  );
}
