import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Sidebar } from './sidebar';
import { DevDataGenerator } from '@/components/DevDataGenerator';
import type { Profile, Notification } from '@/types/database';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

async function switchToUser(formData: FormData) {
  'use server';
  const userId = formData.get('userId') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  if (!userId && !email) return;

  // Try admin magic link first (works for all users)
  if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const targetEmail = email;
      const { data } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: targetEmail,
        options: {
          redirectTo: `${process.env.APP_URL ?? 'https://workforce-platform-omega.vercel.app'}${role === 'supplier' ? '/supplier' : '/dashboard'}`,
        },
      });
      if (data?.properties?.action_link) {
        redirect(data.properties.action_link);
      }
    } catch { /* fall through to password */ }
  }

  // Fallback: password sign-in (works for known test accounts)
  const supabase = await createClient();
  await supabase.auth.signOut();
  await supabase.auth.signInWithPassword({ email, password: 'Test1234!' });
  redirect(role === 'supplier' ? '/supplier' : '/dashboard');
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single();

  const p = profile as Pick<Profile, 'role' | 'full_name' | 'email'> | null;
  const role = p?.role ?? 'candidate';

  if (role === 'supplier') redirect('/supplier');
  const displayName = p?.full_name || p?.email || user.email || '';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const canSeeDemands = ['admin', 'hiring_manager', 'recruiter'].includes(role);

  // Fetch all profiles for user switcher.
  // Migration 015 adds "profiles_select_all_authenticated" so every logged-in
  // role can read all profiles. The admin client is kept as a safe fallback.
  const profilesClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : supabase;
  const [
    { data: allProfilesData },
    { data: supplierProfiles },
    { count: newSubmissionsCount },
    { count: newDemandsCount },
    { count: newCandidatesCount },
    { count: newSuppliersCount },
    { count: newEngagementsCount },
    { data: notificationsData },
  ] = await Promise.all([
    profilesClient.from('profiles').select('id, role, full_name, email').order('role'),
    profilesClient.from('suppliers').select('profile_id, company_name').not('profile_id', 'is', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'new_submission').is('read_at', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'demand_created').is('read_at', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'candidate_created').is('read_at', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'supplier_created').is('read_at', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'engagement_created').is('read_at', null),
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
  ]);
  const supplierNameMap = Object.fromEntries(
    ((supplierProfiles ?? []) as { profile_id: string; company_name: string }[]).map(s => [s.profile_id, s.company_name])
  );
  const allUsers = ((allProfilesData ?? []) as Pick<Profile, 'id' | 'role' | 'full_name' | 'email'>[])
    .filter(p => p.email)
    .map(p => ({
      id: p.id,
      email: p.email!,
      role: p.role,
      displayName: p.role === 'supplier' && supplierNameMap[p.id]
        ? supplierNameMap[p.id]
        : (p.full_name || p.email || p.id),
    }));

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <Sidebar
        displayName={displayName}
        initial={initial}
        role={role}
        canSeeDemands={canSeeDemands}
        newDemandsCount={newDemandsCount ?? 0}
        newSuppliersCount={newSuppliersCount ?? 0}
        newCandidatesCount={newCandidatesCount ?? 0}
        newSubmissionsCount={newSubmissionsCount ?? 0}
        newEngagementsCount={newEngagementsCount ?? 0}
        notifications={(notificationsData ?? []) as Notification[]}
        userId={user.id}
        signOut={signOut}
        switchToUser={switchToUser}
        allUsers={allUsers}
      />

      {/*
        md:ml-56  → push content right of sidebar on desktop
        pt-14     → clear the mobile top bar (h-14)
        md:pt-0   → no top padding needed on desktop
      */}
      <main className="md:ml-56 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>

      <DevDataGenerator />
    </div>
  );
}
