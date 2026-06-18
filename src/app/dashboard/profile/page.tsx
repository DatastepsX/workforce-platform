import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProfilePageTabs } from './profile-page-tabs';
import type { CandidateProfile, Profile, SoftSkillRating } from '@/types/database';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profileData }, { data: cpData }, { data: ratingsData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('candidate_profiles').select('*').eq('id', user.id).single(),
    supabase.from('soft_skill_ratings').select('*').eq('candidate_profile_id', user.id),
  ]);

  const profile = profileData as Profile | null;
  if (profile?.role !== 'candidate') redirect('/dashboard');

  const cp = cpData as CandidateProfile | null;
  const softSkillRatings = (ratingsData ?? []) as SoftSkillRating[];

  let cvSignedUrl: string | null = null;
  if (cp?.cv_path) {
    const { data } = await supabase.storage.from('cvs').createSignedUrl(cp.cv_path, 3600);
    cvSignedUrl = data?.signedUrl ?? null;
  }

  const displayName = profile?.full_name || cp?.full_name || profile?.email || user.email || '';
  const userEmail   = profile?.email || user.email || '';

  return (
    <div className="px-6 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">Mein Konto</h1>
        <p className="text-[15px] text-[#8E8E93] mt-0.5">{displayName}</p>
      </div>
      <ProfilePageTabs
        userId={user.id}
        displayName={displayName}
        userEmail={userEmail}
        profile={cp}
        cvSignedUrl={cvSignedUrl}
        softSkillRatings={softSkillRatings}
      />
    </div>
  );
}
