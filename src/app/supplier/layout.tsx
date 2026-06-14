import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
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

  // Only supplier role (or admin for testing) can access this portal
  if (profile?.role && !['supplier', 'admin'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const displayName = profile?.full_name || profile?.email || user.email || '';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Top bar */}
      <header className="bg-white border-b border-[#E5E5EA] px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <span className="text-[17px] font-bold tracking-tight text-black">WorkforceX</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-semibold"
              style={{ backgroundColor: '#007AFF' }}
            >
              {initial}
            </div>
            <span className="text-[13px] text-[#3C3C43] hidden sm:block">{displayName}</span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-[13px] font-medium text-[#FF3B30] hover:opacity-70 transition-opacity"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
