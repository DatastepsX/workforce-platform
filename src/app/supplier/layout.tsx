import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DevDataGenerator } from '@/components/DevDataGenerator';
import { SupplierSidebar } from './supplier-sidebar';
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

  if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${process.env.APP_URL ?? 'https://workforce-platform-omega.vercel.app'}${role === 'supplier' ? '/supplier' : '/dashboard'}`,
        },
      });
      if (data?.properties?.action_link) {
        redirect(data.properties.action_link);
      }
    } catch { /* fall through */ }
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  await supabase.auth.signInWithPassword({ email, password: 'Test1234!' });
  redirect(role === 'supplier' ? '/supplier' : '/dashboard');
}

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single();

  if (profile?.role && !['supplier', 'admin'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const displayName = profile?.full_name || profile?.email || user.email || '';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  const profilesClient = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
  const [{ data: allProfilesData }, { data: supplierProfiles }, { data: notificationsData }, { count: newDemandsRaw }] = await Promise.all([
    profilesClient.from('profiles').select('id, role, full_name, email').order('role'),
    profilesClient.from('suppliers').select('profile_id, company_name').not('profile_id', 'is', null),
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'demand_received').is('read_at', null),
  ]);
  const newDemandsCount = newDemandsRaw ?? 0;
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
      <SupplierSidebar
        displayName={displayName}
        initial={initial}
        newDemandsCount={newDemandsCount}
        notifications={(notificationsData ?? []) as Notification[]}
        userId={user.id}
        signOut={signOut}
        switchToUser={switchToUser}
        allUsers={allUsers}
      />
      <main className="md:ml-56 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>
      <DevDataGenerator />
    </div>
  );
}
