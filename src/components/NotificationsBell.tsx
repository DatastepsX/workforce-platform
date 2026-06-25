'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/actions/notifications';
import type { Notification } from '@/types/database';
import Link from 'next/link';

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

const TYPE_ICONS: Record<string, { bg: string; icon: JSX.Element }> = {
  new_submission: {
    bg: '#007AFF',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 2l-8 5-8-5h16zm0 12H4V9l8 5 8-5v9z"/></svg>,
  },
  engagement_created: {
    bg: '#34C759',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 12l2 2 4-4"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>,
  },
  submission_status: {
    bg: '#FF9500',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z"/></svg>,
  },
  demand_received: {
    bg: '#5856D6',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>,
  },
  demand_created: {
    bg: '#007AFF',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M12 12v4M10 14h4"/></svg>,
  },
  candidate_created: {
    bg: '#5856D6',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  },
  supplier_created: {
    bg: '#FF9500',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  },
  demand_pending_approval: {
    bg: '#FF9500',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  demand_pending_review: {
    bg: '#5856D6',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  },
  demand_returned: {
    bg: '#FF3B30',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>,
  },
  award_pending_approval: {
    bg: '#34C759',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  },
  demand_approved: {
    bg: '#34C759',
    icon: <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>,
  },
};

const NOTIFICATION_LINKS: Record<string, (id: string) => string> = {
  demand:    id => `/dashboard/demands/${id}`,
  candidate: id => `/dashboard/candidates/${id}`,
  supplier:  () => `/dashboard/suppliers`,
  engagement: id => `/dashboard/engagements/${id}`,
};

type DropdownPos = { bottom: number; left: number };

export function NotificationsBell({
  initial,
  userId,
}: {
  initial: Notification[];
  userId: string;
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const [, startTransition] = useTransition();
  const bellRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        bellRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  function handleToggle() {
    if (!open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      // Open above the bell, right of the sidebar
      setPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.right + 12,
      });
    }
    setOpen(v => !v);
  }

  function handleRead(notifId: string) {
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, read_at: new Date().toISOString() } : n)
    );
    startTransition(() => markNotificationRead(notifId));
  }

  function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    startTransition(() => markAllNotificationsRead());
  }

  return (
    <>
      <button
        ref={bellRef}
        onClick={handleToggle}
        className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
        style={{ color: unreadCount > 0 ? '#007AFF' : '#8E8E93', backgroundColor: open ? '#007AFF14' : undefined }}
      >
        {/* Modern filled bell */}
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill={unreadCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#FF3B30] text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Fixed-position dropdown — always visible, above the sidebar bottom */}
      {open && pos && (
        <div
          ref={dropdownRef}
          className="fixed z-[200] w-[340px] bg-white rounded-2xl overflow-hidden"
          style={{
            bottom: pos.bottom,
            left: pos.left,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#F2F2F7] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold text-black">Benachrichtigungen</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#007AFF] text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[12px] text-[#007AFF] hover:opacity-70 transition-opacity font-medium"
              >
                Alle gelesen
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-black mb-0.5">Alles erledigt</p>
                <p className="text-[12px] text-[#8E8E93]">Keine Benachrichtigungen.</p>
              </div>
            ) : (
              notifications.slice(0, 30).map(n => {
                const href = n.related_id && n.related_type
                  ? (NOTIFICATION_LINKS[n.related_type]?.(n.related_id) ?? '/dashboard')
                  : '/dashboard';
                const isUnread = !n.read_at;
                const iconMeta = TYPE_ICONS[n.type] ?? TYPE_ICONS.new_submission;

                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => { if (isUnread) handleRead(n.id); setOpen(false); }}
                    className={`flex items-start gap-3 px-4 py-3.5 transition-colors border-b border-[#F2F2F7] last:border-b-0 ${isUnread ? 'bg-[#007AFF]/[0.04] hover:bg-[#007AFF]/[0.07]' : 'hover:bg-[#F9F9FB]'}`}
                  >
                    {/* Type icon */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: iconMeta.bg }}
                    >
                      {iconMeta.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-snug ${isUnread ? 'font-semibold text-black' : 'font-normal text-[#3C3C43]'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-snug">{n.body}</p>
                      )}
                      <p className="text-[10px] text-[#C7C7CC] mt-1">{relativeTime(n.created_at)}</p>
                    </div>

                    {/* Unread dot on the right */}
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-[#007AFF] flex-shrink-0 mt-1.5" />
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
