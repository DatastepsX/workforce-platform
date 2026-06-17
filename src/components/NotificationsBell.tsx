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
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const NOTIFICATION_LINKS: Record<string, (id: string) => string> = {
  demand:      id => `/dashboard/demands/${id}`,
  submission:  () => `/dashboard/submissions`,
  engagement:  id => `/dashboard/engagements/${id}`,
};

export function NotificationsBell({
  initial,
  userId,
}: {
  initial: Notification[];
  userId: string;
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read_at);
  const unreadCount = unread.length;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Supabase Realtime subscription for live updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('notifications')
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

  function handleOpen() {
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
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#8E8E93] hover:text-[#007AFF] hover:bg-[#007AFF]/8 transition-colors"
      >
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3B30] text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.16)] border border-[#E5E5EA] z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F2F7]">
            <span className="text-[14px] font-bold text-black">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[12px] text-[#007AFF] hover:opacity-70 transition-opacity font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[14px] font-semibold text-black mb-1">All caught up!</p>
                <p className="text-[12px] text-[#8E8E93]">No notifications yet.</p>
              </div>
            ) : (
              notifications.slice(0, 20).map(n => {
                const href = n.related_id && n.related_type
                  ? (NOTIFICATION_LINKS[n.related_type]?.(n.related_id) ?? '/dashboard')
                  : '/dashboard';
                const isUnread = !n.read_at;
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => { handleRead(n.id); setOpen(false); }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-[#F9F9FB] transition-colors border-b border-[#F2F2F7] last:border-b-0 ${isUnread ? 'bg-[#007AFF]/4' : ''}`}
                  >
                    {/* Unread dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${isUnread ? 'bg-[#007AFF]' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-tight ${isUnread ? 'font-semibold text-black' : 'font-medium text-[#3C3C43]'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-tight truncate">{n.body}</p>
                      )}
                      <p className="text-[10px] text-[#C7C7CC] mt-1">{relativeTime(n.created_at)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {notifications.length > 20 && (
            <div className="px-4 py-2.5 border-t border-[#F2F2F7]">
              <p className="text-[11px] text-[#8E8E93] text-center">Showing last 20 notifications</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
