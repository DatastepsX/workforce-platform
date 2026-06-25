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
  const { headers } = await import('next/headers');
  const userId = formData.get('userId') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  if (!userId && !email) return;

  const headersList = await headers();
  const host = headersList.get('host') ?? 'workforce-platform-omega.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;
  const dest = role === 'supplier' ? '/supplier' : '/dashboard';

  // Use admin magic link — redirects through /auth/callback which exchanges the
  // PKCE code for a session without the user having to enter credentials.
  if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${origin}/auth/callback?next=${dest}` },
      });
      if (data?.properties?.action_link) {
        redirect(data.properties.action_link);
      }
    } catch { /* fall through */ }
  }

  // Fallback: all test users share the password Test1234!
  const supabase = await createClient();
  await supabase.auth.signOut();
  await supabase.auth.signInWithPassword({ email, password: 'Test1234!' });
  redirect(dest);
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email, tenant_id')
    .eq('id', user.id)
    .single();

  const p = profile as Pick<Profile, 'role' | 'full_name' | 'email' | 'tenant_id'> | null;
  const role = p?.role ?? 'candidate';

  if (role === 'supplier') redirect('/supplier');
  const displayName = p?.full_name || p?.email || user.email || '';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const canSeeDemands = ['super_admin', 'admin', 'hiring_manager', 'recruiter', 'procurement', 'finance'].includes(role);

  // Fetch all profiles for user switcher.
  // Migration 015 adds "profiles_select_all_authenticated" so every logged-in
  // role can read all profiles. The admin client is kept as a safe fallback.
  const profilesClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : supabase;

  // Fetch current user's tenant name
  let tenantName: string | null = null;
  if (p?.tenant_id) {
    const { data: tenantData } = await profilesClient
      .from('tenants')
      .select('name')
      .eq('id', p.tenant_id)
      .single();
    tenantName = (tenantData as { name: string } | null)?.name ?? null;
  }

  const [
    { data: allProfilesData },
    { data: supplierProfiles },
    { count: newSubmissionsCount },
    { count: newDemandsCount },
    { count: newCandidatesCount },
    { count: newSuppliersCount },
    { count: newEngagementsCount },
    { data: notificationsData },
    { count: pendingApprovalCount },
    { count: pendingReviewCount },
    { count: pendingAwardCount },
    { count: demandReturnedCount },
  ] = await Promise.all([
    profilesClient.from('profiles').select('id, role, full_name, email, tenant_id').order('role'),
    profilesClient.from('suppliers').select('profile_id, company_name').not('profile_id', 'is', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'new_submission').is('read_at', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'demand_created').is('read_at', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'candidate_created').is('read_at', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'supplier_created').is('read_at', null),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'engagement_created').is('read_at', null),
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    // Pending approval badge: super_admin/admin sees all; HM sees own; procurement/finance see tenant
    ['super_admin', 'admin'].includes(role)
      ? supabase.from('demands').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval')
      : role === 'hiring_manager'
      ? supabase.from('demands').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval').eq('created_by', user.id)
      : ['procurement', 'finance'].includes(role) && p?.tenant_id
      ? supabase.from('demands').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval').eq('tenant_id', p.tenant_id)
      : Promise.resolve({ count: 0 }),
    // Pending review badge: recruiter/admin sees demands in their tenant awaiting MSP review
    ['super_admin', 'admin', 'recruiter'].includes(role)
      ? p?.tenant_id
        ? supabase.from('demands').select('*', { count: 'exact', head: true }).eq('status', 'pending_review').eq('tenant_id', p.tenant_id)
        : supabase.from('demands').select('*', { count: 'exact', head: true }).eq('status', 'pending_review')
      : Promise.resolve({ count: 0 }),
    // Pending award badge: admin/recruiter/procurement/finance see award-status demands in tenant
    ['super_admin', 'admin', 'recruiter', 'procurement', 'finance'].includes(role)
      ? p?.tenant_id
        ? supabase.from('demands').select('*', { count: 'exact', head: true }).eq('status', 'award').eq('tenant_id', p.tenant_id)
        : supabase.from('demands').select('*', { count: 'exact', head: true }).eq('status', 'award')
      : Promise.resolve({ count: 0 }),
    // Demand returned badge: HM sees unread demand_returned notifications
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'demand_returned').is('read_at', null),
  ]);
  const supplierNameMap = Object.fromEntries(
    ((supplierProfiles ?? []) as { profile_id: string; company_name: string }[]).map(s => [s.profile_id, s.company_name])
  );

  // For candidate-role users, look up candidate_profiles.full_name (where they actually set their name)
  const allProfilesList = (allProfilesData ?? []) as Pick<Profile, 'id' | 'role' | 'full_name' | 'email' | 'tenant_id'>[];

  // Build tenant name + role label maps for user switcher
  const allTenantIds = Array.from(new Set(allProfilesList.filter(p => p.tenant_id).map(p => p.tenant_id))) as string[];
  let allTenantNameMap: Record<string, string> = {};
  // tenantRoleLabelMap: "<tenant_id>:<role_key>" → configured label
  let tenantRoleLabelMap: Record<string, string> = {};
  if (allTenantIds.length > 0) {
    const [{ data: allTenantsData }, { data: tenantRolesData }] = await Promise.all([
      profilesClient.from('tenants').select('id, name').in('id', allTenantIds),
      profilesClient.from('tenant_roles').select('tenant_id, role_key, label').in('tenant_id', allTenantIds),
    ]);
    allTenantNameMap = Object.fromEntries(
      ((allTenantsData ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name])
    );
    tenantRoleLabelMap = Object.fromEntries(
      ((tenantRolesData ?? []) as { tenant_id: string; role_key: string; label: string }[])
        .map(r => [`${r.tenant_id}:${r.role_key}`, r.label])
    );
  }

  const candidateIds = allProfilesList.filter(p => p.role === 'candidate').map(p => p.id);
  let candidateProfileNameMap: Record<string, string> = {};
  if (candidateIds.length > 0) {
    const { data: cpNames } = await profilesClient
      .from('candidate_profiles')
      .select('id, full_name')
      .in('id', candidateIds)
      .not('full_name', 'is', null);
    candidateProfileNameMap = Object.fromEntries(
      ((cpNames ?? []) as { id: string; full_name: string }[])
        .filter(c => c.full_name && !c.full_name.includes('@'))
        .map(c => [c.id, c.full_name])
    );
  }

  const allUsers = allProfilesList
    .filter(p => p.email)
    .map(p => ({
      id: p.id,
      email: p.email!,
      role: p.role,
      displayName: p.role === 'supplier' && supplierNameMap[p.id]
        ? supplierNameMap[p.id]
        : p.role === 'candidate' && candidateProfileNameMap[p.id]
        ? candidateProfileNameMap[p.id]
        : (p.full_name || p.email || p.id),
      tenantName: p.tenant_id ? (allTenantNameMap[p.tenant_id] ?? null) : null,
      configuredRoleLabel: p.tenant_id ? (tenantRoleLabelMap[`${p.tenant_id}:${p.role}`] ?? null) : null,
    }));

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <Sidebar
        displayName={displayName}
        initial={initial}
        role={role}
        tenantId={p?.tenant_id ?? null}
        tenantName={tenantName}
        canSeeDemands={canSeeDemands}
        newDemandsCount={newDemandsCount ?? 0}
        newSuppliersCount={newSuppliersCount ?? 0}
        newCandidatesCount={newCandidatesCount ?? 0}
        newSubmissionsCount={newSubmissionsCount ?? 0}
        newEngagementsCount={newEngagementsCount ?? 0}
        pendingApprovalCount={pendingApprovalCount ?? 0}
        pendingReviewCount={pendingReviewCount ?? 0}
        pendingAwardCount={pendingAwardCount ?? 0}
        demandReturnedCount={demandReturnedCount ?? 0}
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
