import { createClient } from '@/lib/supabase/server';
import type { SocialPost, Demand } from '@/types/database';
import { SocialMediaClient } from './social-media-client';

interface Props {
  demand: Demand;
  canEdit: boolean;
}

export async function SocialMediaTab({ demand, canEdit }: Props) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('social_posts')
    .select('*')
    .eq('demand_id', demand.id)
    .order('created_at', { ascending: false });

  const posts = (data ?? []) as SocialPost[];

  return (
    <SocialMediaClient
      posts={posts}
      demand={demand}
      canEdit={canEdit}
    />
  );
}
