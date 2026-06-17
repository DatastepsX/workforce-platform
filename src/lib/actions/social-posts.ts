'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateContent } from '@/lib/social-media/generator';
import type { SocialPlatform, Demand } from '@/types/database';

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_VERCEL_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  return 'http://localhost:3000';
}

function makeTrackingCode(): string {
  return Math.random().toString(36).slice(2, 10);
}

function revalidate(demandId: string) {
  revalidatePath(`/dashboard/demands/${demandId}`);
  revalidatePath('/dashboard/social-media');
}

export async function generateSocialPosts(demandId: string, platforms: SocialPlatform[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: demandData, error: demandError } = await supabase
    .from('demands')
    .select('*')
    .eq('id', demandId)
    .single();
  if (demandError || !demandData) throw new Error('Demand not found');
  const demand = demandData as Demand;

  const base = getBaseUrl();

  const rows = platforms.map(platform => {
    const trackingCode = makeTrackingCode();
    const trackingUrl = `${base}/careers/${demandId}?ref=${trackingCode}`;
    const { caption, hashtags } = generateContent(platform, demand, trackingUrl);
    return {
      demand_id: demandId,
      platform,
      status: 'draft' as const,
      caption,
      hashtags,
      tracking_code: trackingCode,
      tracking_url: trackingUrl,
      created_by: user.id,
    };
  });

  const { error } = await supabase.from('social_posts').insert(rows);
  if (error) throw new Error(error.message);
  revalidate(demandId);
}

export async function updateSocialPostContent(
  postId: string,
  demandId: string,
  caption: string,
  hashtags: string[],
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('social_posts')
    .update({ caption, hashtags, updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw new Error(error.message);
  revalidate(demandId);
}

export async function approveSocialPost(postId: string, demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('social_posts')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', postId)
    .in('status', ['draft', 'rejected']);
  if (error) throw new Error(error.message);
  revalidate(demandId);
}

export async function rejectSocialPost(postId: string, demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('social_posts')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('status', 'approved');
  if (error) throw new Error(error.message);
  revalidate(demandId);
}

export async function reviseSocialPost(postId: string, demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('social_posts')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('status', 'rejected');
  if (error) throw new Error(error.message);
  revalidate(demandId);
}

export async function markSocialPostPosted(postId: string, demandId: string, externalUrl?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('social_posts')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      external_post_url: externalUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('status', 'approved');
  if (error) throw new Error(error.message);
  revalidate(demandId);
}

export async function archiveSocialPost(postId: string, demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('social_posts')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .not('status', 'eq', 'archived');
  if (error) throw new Error(error.message);
  revalidate(demandId);
}

export async function deleteSocialPost(postId: string, demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase.from('social_posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
  revalidate(demandId);
}

export async function regenerateSocialPost(postId: string, demandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const [{ data: postData }, { data: demandData }] = await Promise.all([
    supabase.from('social_posts').select('platform, tracking_url').eq('id', postId).single(),
    supabase.from('demands').select('*').eq('id', demandId).single(),
  ]);
  if (!postData || !demandData) throw new Error('Not found');

  const { caption, hashtags } = generateContent(
    postData.platform as SocialPlatform,
    demandData as Demand,
    postData.tracking_url ?? '',
  );

  const { error } = await supabase
    .from('social_posts')
    .update({ caption, hashtags, status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw new Error(error.message);
  revalidate(demandId);
}
