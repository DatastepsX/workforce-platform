import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from './sidebar';
import { DevDataGenerator } from '@/components/DevDataGenerator';
import type { Profile } from '@/types/database';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
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
  const displayName = p?.full_name || p?.email || user.email || '';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const canSeeDemands = ['admin', 'hiring_manager', 'recruiter'].includes(role);

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <Sidebar
        displayName={displayName}
        initial={initial}
        role={role}
        canSeeDemands={canSeeDemands}
        signOut={signOut}
      />

      {/*
        md:ml-56  → push content right of sidebar on desktop
        pt-14     → clear the mobile top bar (h-14)
        md:pt-0   → no top padding needed on desktop
      */}
      <main className="md:ml-56 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>

      {role === 'admin' && <DevDataGenerator />}
    </div>
  );
}
