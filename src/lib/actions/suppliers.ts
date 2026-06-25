'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailDemandSentToSupplier } from '@/lib/email';
import { createNotifications } from '@/lib/actions/notifications';
import type { DemandSupplierStatus } from '@/types/database';

export async function createSupplier(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: myProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter'].includes(myProfile?.role ?? '')) redirect('/dashboard');

  const email = formData.get('email') as string;
  const specializations = (formData.get('specializations') as string)
    .split(',').map(s => s.trim()).filter(Boolean);

  const { data: supplier, error } = await supabase.from('suppliers').insert({
    company_name: formData.get('company_name') as string,
    contact_name: (formData.get('contact_name') as string) || null,
    email,
    phone: (formData.get('phone') as string) || null,
    specializations,
    status: 'active',
  }).select('id').single();

  if (error) throw new Error(error.message);

  // Invite supplier user via admin API (requires SUPABASE_SERVICE_ROLE_KEY)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = createAdminClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://workforce-platform-omega.vercel.app';

      const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/supplier`,
      });

      let profileId: string | null = inviteData?.user?.id ?? null;

      if (inviteErr) {
        // User may already exist — find by email
        const { data: existing } = await admin
          .from('profiles').select('id').eq('email', email).single();
        profileId = existing?.id ?? null;
      }

      // Set a default password so supplier can log in immediately (MVP / dev convenience)
      if (profileId) {
        await admin.auth.admin.updateUserById(profileId, {
          password: 'Test1234!',
          email_confirm: true,
        });
      }

      if (profileId) {
        await admin.from('profiles')
          .upsert({ id: profileId, role: 'supplier', email }, { onConflict: 'id' });
        await admin.from('suppliers')
          .update({ profile_id: profileId }).eq('id', supplier.id);
      }
    } catch (adminErr) {
      // Non-blocking — supplier record still created
      console.error('Supplier invite failed:', adminErr);
    }
  }

  // Notify all recruiters/admins about new supplier
  try {
    const notifyAdmin = createAdminClient();
    const { data: targets } = await notifyAdmin
      .from('profiles').select('id').in('role', ['recruiter', 'admin']);
    const ids = (targets ?? []).map(r => r.id).filter(id => id !== user.id);
    if (ids.length) {
      await createNotifications({
        userIds: ids,
        type: 'supplier_created',
        title: `Neuer Supplier: ${formData.get('company_name') as string}`,
        body: formData.get('specializations') as string || undefined,
        relatedId: supplier.id,
        relatedType: 'supplier',
      });
    }
  } catch { /* non-blocking */ }

  revalidatePath('/dashboard/suppliers');
  redirect('/dashboard/suppliers');
}

export async function updateSupplier(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'recruiter'].includes(profile?.role ?? '')) redirect('/dashboard/suppliers');

  const id = formData.get('id') as string;
  const specializations = (formData.get('specializations') as string)
    .split(',').map(s => s.trim()).filter(Boolean);

  const { error } = await supabase.from('suppliers').update({
    company_name: formData.get('company_name') as string,
    contact_name: (formData.get('contact_name') as string) || null,
    email: formData.get('email') as string,
    phone: (formData.get('phone') as string) || null,
    specializations,
    status: formData.get('status') as 'active' | 'inactive',
  }).eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/suppliers');
  redirect('/dashboard/suppliers');
}

export async function deleteSupplier(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard/suppliers');

  const id = formData.get('id') as string;
  await supabase.from('demand_suppliers').delete().eq('supplier_id', id);
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/suppliers');
  redirect('/dashboard/suppliers');
}

// Pre-assign suppliers during MSP review (no email — demand not yet approved)
export async function assignSuppliersForReview(demandId: string, supplierIds: string[]) {
  if (!supplierIds.length) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  const role = profile?.role ?? '';

  const admin = createAdminClient();
  const { data: demand } = await admin.from('demands').select('status, created_by').eq('id', demandId).single();
  if (!demand) throw new Error('Demand not found');

  const allowedStatuses = ['pending_review', 'pending_approval'];
  if (!allowedStatuses.includes(demand.status)) throw new Error('Cannot assign suppliers at this stage');

  const isRecruiterOrAdmin = ['super_admin', 'admin', 'recruiter'].includes(role);
  const isHM = role === 'hiring_manager' && demand.created_by === user.id;
  const isApprover = ['procurement', 'finance'].includes(role) && demand.status === 'pending_approval';
  if (!isRecruiterOrAdmin && !isHM && !isApprover) throw new Error('Not authorized');

  const { error } = await admin.from('demand_suppliers').insert(
    supplierIds.map(sid => ({
      demand_id: demandId,
      supplier_id: sid,
      status: 'preassigned' as DemandSupplierStatus,
    })),
  );
  if (error) throw new Error(error.message);

  try {
    const { data: senderProfile } = await supabase.from('profiles').select('full_name, email, role').eq('id', user.id).single();
    const { data: assignedSuppliers } = await admin.from('suppliers').select('company_name').in('id', supplierIds);
    const names = (assignedSuppliers ?? []).map((s: { company_name: string }) => s.company_name).join(', ');
    await admin.from('process_history').insert({
      demand_id: demandId,
      to_status: demand.status,
      action: 'SUPPLIERS_PREASSIGNED',
      actor_id: user.id,
      actor_role: senderProfile?.role ?? null,
      actor_name: senderProfile?.full_name || senderProfile?.email || null,
      notes: `Pre-assigned: ${names}`,
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/dashboard/demands/${demandId}`);
}

export async function sendToSuppliers(
  demandId: string,
  supplierIds: string[],
  deadline: string | null,
) {
  if (!supplierIds.length) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;

  if (!['super_admin', 'admin', 'recruiter', 'hiring_manager'].includes(role ?? '')) throw new Error('Not authorized');

  // Use admin client to read demand + insert (bypass RLS restrictions on demand_suppliers)
  const admin = createAdminClient();
  const { data: demand } = await admin.from('demands').select('created_by, status').eq('id', demandId).single();
  if (!demand) throw new Error('Demand not found');

  // Hiring managers may only send their own demands
  if (role === 'hiring_manager' && demand.created_by !== user.id) throw new Error('Not authorized');

  if (demand.status !== 'sourcing') {
    throw new Error('This demand is not yet open for sourcing. Complete the review and approval steps before sending it to suppliers.');
  }

  // Separate new suppliers from previously pre-assigned ones (upsert pre-assigned to 'sent')
  const { data: existing } = await admin.from('demand_suppliers')
    .select('supplier_id, status')
    .eq('demand_id', demandId)
    .in('supplier_id', supplierIds);
  const existingMap = new Map((existing ?? []).map((e: { supplier_id: string; status: string }) => [e.supplier_id, e.status]));
  const toInsert = supplierIds.filter(sid => !existingMap.has(sid));
  const toActivate = supplierIds.filter(sid => existingMap.get(sid) === 'preassigned');

  if (toInsert.length) {
    const { error } = await admin.from('demand_suppliers').insert(
      toInsert.map(sid => ({ demand_id: demandId, supplier_id: sid, status: 'sent' as DemandSupplierStatus, deadline: deadline || null })),
    );
    if (error) throw new Error(error.message);
  }
  if (toActivate.length) {
    await admin.from('demand_suppliers')
      .update({ status: 'sent' as DemandSupplierStatus, deadline: deadline || null })
      .eq('demand_id', demandId)
      .in('supplier_id', toActivate);
  }

  const allHandled = [...toInsert, ...toActivate];
  if (!allHandled.length) return;

  // Log to process history
  try {
    const { data: senderProfile } = await supabase.from('profiles').select('full_name, email, role').eq('id', user.id).single();
    const { data: sentSuppliers } = await admin.from('suppliers').select('company_name').in('id', allHandled);
    const supplierNames = (sentSuppliers ?? []).map((s: { company_name: string }) => s.company_name).join(', ');
    await admin.from('process_history').insert({
      demand_id: demandId,
      to_status: 'sourcing',
      action: 'DEMAND_SENT_TO_SUPPLIERS',
      actor_id: user.id,
      actor_role: senderProfile?.role ?? null,
      actor_name: senderProfile?.full_name || senderProfile?.email || null,
      notes: `Sent to: ${supplierNames}`,
    });
  } catch { /* non-blocking */ }

  // Send notification emails to each supplier
  try {
    const { data: demand } = await admin.from('demands').select('title').eq('id', demandId).single();
    const { data: suppliers } = await admin.from('suppliers')
      .select('id, email, contact_name, company_name')
      .in('id', allHandled);

    if (demand && suppliers) {
      for (const s of suppliers) {
        await emailDemandSentToSupplier({
          supplierEmail: s.email,
          supplierName: s.contact_name ?? s.company_name,
          demandTitle: demand.title,
          demandId,
          deadline,
        });
      }

      // In-app notification for each supplier's user account
      const { data: supplierProfiles } = await admin
        .from('suppliers')
        .select('profile_id')
        .in('id', allHandled)
        .not('profile_id', 'is', null);
      const profileIds = (supplierProfiles ?? [])
        .map((s: { profile_id: string | null }) => s.profile_id)
        .filter((id): id is string => !!id);
      if (profileIds.length) {
        await createNotifications({
          userIds: profileIds,
          type: 'demand_received',
          title: `Neue Anfrage: ${demand.title}`,
          body: deadline ? `Deadline: ${new Date(deadline).toLocaleDateString('de-DE')}` : undefined,
          relatedId: demandId,
          relatedType: 'demand',
        });
      }
    }
  } catch { /* non-blocking */ }

  revalidatePath(`/dashboard/demands/${demandId}`);
}

export async function updateDemandSupplierStatus(
  id: string,
  status: DemandSupplierStatus,
  demandId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('demand_suppliers')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/demands/${demandId}`);
}
