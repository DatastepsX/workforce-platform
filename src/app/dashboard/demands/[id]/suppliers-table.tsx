import { createAdminClient } from '@/lib/supabase/admin';
import type { DemandSupplierStatus, SubmissionStatus } from '@/types/database';
import { SuppliersTableClient, type SupplierRow } from './suppliers-table-client';

export async function SuppliersTable({ demandId }: { demandId: string }) {
  const admin = createAdminClient();

  const { data: dsRows } = await admin
    .from('demand_suppliers')
    .select('*')
    .eq('demand_id', demandId);

  if (!dsRows?.length) {
    return <SuppliersTableClient rows={[]} />;
  }

  const supplierIds = dsRows.map(r => r.supplier_id);

  const [{ data: suppliersData }, { data: subsData }] = await Promise.all([
    admin
      .from('suppliers')
      .select('id, company_name, contact_name, email, phone, specializations')
      .in('id', supplierIds),
    admin
      .from('candidate_submissions')
      .select('id, supplier_id, candidate_name, status, proposed_rate, rate_type')
      .eq('demand_id', demandId),
  ]);

  const supplierMap = Object.fromEntries(
    (suppliersData ?? []).map(s => [s.id, s])
  );

  const rows: SupplierRow[] = dsRows
    .map(ds => {
      const supplier = supplierMap[ds.supplier_id];
      if (!supplier) return null;

      const candidates = (subsData ?? [])
        .filter(sub => sub.supplier_id === ds.supplier_id)
        .map(sub => ({
          id: sub.id as string,
          name: sub.candidate_name as string,
          status: sub.status as SubmissionStatus,
          proposedRate: (sub.proposed_rate as number | null) ?? null,
          rateType: (sub.rate_type as string | null) ?? null,
        }));

      return {
        demandSupplierId: ds.id as string,
        supplierId: ds.supplier_id as string,
        demandId,
        companyName: supplier.company_name as string,
        contactName: (supplier.contact_name as string | null) ?? null,
        email: supplier.email as string,
        phone: (supplier.phone as string | null) ?? null,
        specializations: (supplier.specializations as string[]) ?? [],
        relationStatus: ds.status as DemandSupplierStatus,
        sentAt: ds.sent_at as string,
        deadline: (ds.deadline as string | null) ?? null,
        candidates,
      } satisfies SupplierRow;
    })
    .filter((r): r is SupplierRow => r !== null);

  return <SuppliersTableClient rows={rows} />;
}
