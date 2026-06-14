'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { DemandSupplierStatus } from '@/types/database';

export async function createSupplier(formData: FormData) {
  const supabase = await createClient();

  const specializations = (formData.get('specializations') as string)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const { error } = await supabase.from('suppliers').insert({
    company_name: formData.get('company_name') as string,
    contact_name: (formData.get('contact_name') as string) || null,
    email: formData.get('email') as string,
    phone: (formData.get('phone') as string) || null,
    specializations,
    status: 'active',
  });

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

  // Fire email edge function for each supplier (best-effort — won't break if not deployed)
  for (const supplierId of supplierIds) {
    try {
      await supabase.functions.invoke('send-demand-email', {
        body: { demand_id: demandId, supplier_id: supplierId },
      });
    } catch {
      // Edge function not deployed yet — skip silently
    }
  }

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
