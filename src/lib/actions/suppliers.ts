'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { emailDemandSentToSupplier } from '@/lib/email';
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

export async function sendToSuppliers(
  demandId: string,
  supplierIds: string[],
  deadline: string | null,
) {
  if (!supplierIds.length) return;

  const supabase = await createClient();

  const { error } = await supabase.from('demand_suppliers').insert(
    supplierIds.map(sid => ({
      demand_id: demandId,
      supplier_id: sid,
      status: 'sent' as DemandSupplierStatus,
      deadline: deadline || null,
    })),
  );

  if (error) throw new Error(error.message);

  // Send notification emails to each supplier
  try {
    const { data: demand } = await supabase.from('demands').select('title').eq('id', demandId).single();
    const { data: suppliers } = await supabase.from('suppliers')
      .select('id, email, contact_name, company_name')
      .in('id', supplierIds);

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
