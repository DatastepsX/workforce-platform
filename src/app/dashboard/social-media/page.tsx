import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { SocialPost, Demand, UserRole } from '@/types/database';
import { SocialMediaOverviewClient } from './social-media-overview-client';

export const dynamic = 'force-dynamic';

export type DemandSnapshot = Pick<Demand,
  'id' | 'title' | 'location' | 'contract_type' | 'remote_allowed' |
  'budget_max' | 'budget_min' | 'start_date' | 'skills'
>;

export interface PostWithDemand extends SocialPost {
  demand: DemandSnapshot;
}

export default async function SocialMediaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profileData?.role ?? 'candidate') as UserRole;
  if (!['super_admin', 'admin', 'recruiter'].includes(role)) redirect('/dashboard');

  const { data } = await supabase
    .from('social_posts')
    .select(`
      *,
      demand:demands(id, title, location, contract_type, remote_allowed, budget_max, budget_min, start_date, skills)
    `)
    .order('created_at', { ascending: false });

  const posts = (data ?? []) as PostWithDemand[];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-[28px] font-bold text-black tracking-tight mb-1">Social Media</h1>
      <p className="text-[14px] text-[#8E8E93] mb-8">
        Alle Posts aus sämtlichen Demands verwalten
      </p>
      <SocialMediaOverviewClient posts={posts} />
    </div>
  );
}
