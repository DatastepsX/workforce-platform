'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface NotifyInput {
  userIds: string[];
  type: string;
  title: string;
  body?: string;
  relatedId?: string;
  relatedType?: string;
}

export async function createNotifications({ userIds, type, title, body, relatedId, relatedType }: NotifyInput) {
  if (!userIds.length) return;
  try {
    const admin = createAdminClient();
    const { error, data: inserted } = await admin.from('notifications').insert(
      userIds.map(uid => ({
        user_id: uid,
        type,
        title,
        body: body ?? null,
        related_id: relatedId ?? null,
        related_type: relatedType ?? null,
      }))
    ).select('id');
    if (error) console.error('[notifications] insert error:', error.message, '| type:', type, '| users:', userIds.length);
    else console.log('[notifications] inserted', inserted?.length ?? '?', 'rows, type:', type);
  } catch (e) {
    console.error('[notifications] threw:', e);
  }
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  revalidatePath('/dashboard', 'layout');
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  revalidatePath('/dashboard', 'layout');
}

async function markTypeRead(type: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('type', type)
    .is('read_at', null);
  revalidatePath('/dashboard', 'layout');
}

export async function markSubmissionNotificationsRead() {
  return markTypeRead('new_submission');
}

export async function markDemandNotificationReadById(demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('type', 'demand_created')
    .eq('related_id', demandId)
    .is('read_at', null);
  revalidatePath('/dashboard', 'layout');
}

export async function markDemandNotificationsRead() {
  return markTypeRead('demand_created');
}

export async function markCandidateNotificationsRead() {
  return markTypeRead('candidate_created');
}

export async function markSupplierNotificationsRead() {
  return markTypeRead('supplier_created');
}

export async function markEngagementNotificationsRead() {
  return markTypeRead('engagement_created');
}
