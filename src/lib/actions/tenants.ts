'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { trackApiCall } from '@/lib/api-tracker';

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) throw new Error('Admin only');
}

export async function createTenant(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const name = (formData.get('name') as string).trim();
  const slug = (formData.get('slug') as string).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!name || !slug) return { error: 'Name and slug are required' };

  const { data: tenant, error } = await admin
    .from('tenants')
    .insert({ name, slug, active: true })
    .select()
    .single();

  if (error) return { error: error.message };

  // Create default config
  await admin.from('tenant_configs').insert({ tenant_id: tenant.id });

  revalidatePath('/dashboard/settings/tenants');
  return { success: true, id: tenant.id };
}

export async function updateTenant(id: string, formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const name = (formData.get('name') as string).trim();
  const slug = (formData.get('slug') as string).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const active = formData.getAll('active').includes('true');

  const { error } = await admin
    .from('tenants')
    .update({ name, slug, active, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/settings/tenants');
  revalidatePath(`/dashboard/settings/tenants/${id}`);
  return { success: true };
}

export async function updateTenantConfig(tenantId: string, formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();

  // Use getAll().includes('true') because the hidden+checkbox pattern submits both
  // "false" (hidden) and "true" (checkbox) — formData.get() would always return "false" (first value).
  const bool = (key: string) => formData.getAll(key).includes('true');

  const patch = {
    demand_msp_review:      bool('demand_msp_review'),
    demand_approval_levels: parseInt(formData.get('demand_approval_levels') as string) || 1,
    demand_approval_role_l1: formData.get('demand_approval_role_l1') as string || 'hiring_manager',
    demand_approval_role_l2: (formData.get('demand_approval_role_l2') as string) || null,
    demand_approval_role_l3: (formData.get('demand_approval_role_l3') as string) || null,
    demand_msp_screening:   bool('demand_msp_screening'),
    award_msp_offer:        bool('award_msp_offer'),
    award_approval_levels:  parseInt(formData.get('award_approval_levels') as string) || 0,
    award_approval_role_l1: (formData.get('award_approval_role_l1') as string) || null,
    award_approval_role_l2: (formData.get('award_approval_role_l2') as string) || null,
    award_approval_role_l3: (formData.get('award_approval_role_l3') as string) || null,
    award_po_step:          bool('award_po_step'),
    updated_at:             new Date().toISOString(),
  };

  // Upsert: create config if it doesn't exist yet
  const { error } = await admin
    .from('tenant_configs')
    .upsert({ tenant_id: tenantId, ...patch }, { onConflict: 'tenant_id' });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
  return { success: true };
}

export async function saveTenantRoles(tenantId: string, formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();

  const ROLE_KEYS = ['admin', 'recruiter', 'hiring_manager', 'procurement', 'finance', 'supplier', 'candidate'];
  const upserts = ROLE_KEYS
    .filter(key => formData.get(`role_label_${key}`))
    .map(key => ({
      tenant_id: tenantId,
      role_key: key,
      label: (formData.get(`role_label_${key}`) as string).trim(),
      active: formData.getAll(`role_active_${key}`).includes('true'),
    }));

  if (!upserts.length) return { success: true };
  const { error } = await admin
    .from('tenant_roles')
    .upsert(upserts, { onConflict: 'tenant_id,role_key' });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
  return { success: true };
}

export async function inviteUserToTenant(tenantId: string, formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();

  const email = (formData.get('email') as string).trim().toLowerCase();
  const role = formData.get('role') as string;
  const fullName = (formData.get('full_name') as string | null)?.trim() || null;
  if (!email || !role) return { error: 'Email and role are required' };

  // Check if profile already exists
  const { data: existing } = await admin
    .from('profiles')
    .select('id, tenant_id')
    .eq('email', email)
    .single();

  if (existing) {
    // Assign existing user to tenant
    const { error } = await admin
      .from('profiles')
      .update({ tenant_id: tenantId, role: role as 'admin' | 'hiring_manager' | 'recruiter' | 'candidate' | 'supplier' })
      .eq('id', existing.id);
    if (error) return { error: error.message };
    revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
    return { success: true, existing: true };
  }

  // Use provided password or auto-generate
  const providedPassword = (formData.get('password') as string | null)?.trim();
  const tempPassword = providedPassword && providedPassword.length >= 8
    ? null
    : `WFX-${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
  const password = providedPassword && providedPassword.length >= 8 ? providedPassword : tempPassword!;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authError) return { error: authError.message };

  // Set profile role + tenant
  await admin.from('profiles').upsert({
    id: authData.user.id,
    email,
    full_name: fullName,
    role: role as 'admin' | 'hiring_manager' | 'recruiter' | 'candidate' | 'supplier',
    tenant_id: tenantId,
  }, { onConflict: 'id' });

  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
  // Only reveal the password if it was auto-generated (not user-provided)
  return { success: true, tempPassword: tempPassword ?? undefined, email };
}

export async function assignSupplierToTenant(tenantId: string, supplierId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_suppliers')
    .upsert({ tenant_id: tenantId, supplier_id: supplierId, active: true }, { onConflict: 'tenant_id,supplier_id' });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
  return { success: true };
}

export async function toggleTenantSupplier(tenantId: string, supplierId: string, active: boolean) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_suppliers')
    .update({ active })
    .eq('tenant_id', tenantId)
    .eq('supplier_id', supplierId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
  return { success: true };
}

export async function removeSupplierFromTenant(tenantId: string, supplierId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_suppliers')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('supplier_id', supplierId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
  return { success: true };
}

export interface GeneratedTenantUser {
  role: string;
  configuredLabel: string;
  full_name: string;
  jobTitle: string;
  email: string;
  password: string;
}

export interface GeneratedTenantSupplier {
  company_name: string;
  contact_person: string;
  email: string;
}

export interface GeneratedTenantResult {
  tenantId: string;
  tenantName: string;
  slug: string;
  industry: string;
  users: GeneratedTenantUser[];
  suppliers: GeneratedTenantSupplier[];
  candidatesCreated: number;
  error?: string;
}

export async function generateTestTenant(): Promise<GeneratedTenantResult> {
  await assertAdmin();
  const admin = createAdminClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Step 1: Generate company + user data with Claude
  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Generate realistic test data for a DACH enterprise client on a Workforce Management Platform (MSP model).

Return ONLY valid JSON — no markdown, no explanation:
{
  "company": {
    "name": "Fictional DACH company — e.g. 'Velotherm GmbH', 'Nordaxis AG', 'Krautfeld SE'. No real companies.",
    "slug": "lowercase-kebab-no-umlauts",
    "industry": "Industry sector in English"
  },
  "roleLabels": {
    "admin": "...", "recruiter": "...", "hiring_manager": "...",
    "procurement": "...", "finance": "...", "supplier": "...", "candidate": "..."
  },
  "approvalConfig": {
    "demand_approval_levels": 2,
    "demand_approval_role_l1": "hiring_manager",
    "demand_approval_role_l2": "procurement",
    "demand_approval_role_l3": null,
    "award_approval_levels": 3,
    "award_approval_role_l1": "procurement",
    "award_approval_role_l2": "finance",
    "award_approval_role_l3": "admin"
  },
  "suppliers": [
    { "company_name": "fictional staffing/recruitment agency name", "contact_name": "Full Name", "email": "fictional@example.com", "phone": "+49..." },
    { "company_name": "...", "contact_name": "...", "email": "...", "phone": "+49..." },
    { "company_name": "...", "contact_name": "...", "email": "...", "phone": "+49..." }
  ],
  "users": [
    { "role": "admin",          "full_name": "...", "jobTitle": "..." },
    { "role": "recruiter",      "full_name": "...", "jobTitle": "..." },
    { "role": "recruiter",      "full_name": "...", "jobTitle": "..." },
    { "role": "hiring_manager", "full_name": "...", "jobTitle": "..." },
    { "role": "hiring_manager", "full_name": "...", "jobTitle": "..." },
    { "role": "hiring_manager", "full_name": "...", "jobTitle": "..." },
    { "role": "procurement",    "full_name": "...", "jobTitle": "..." },
    { "role": "finance",        "full_name": "...", "jobTitle": "..." },
    { "role": "supplier",       "full_name": "...", "jobTitle": "..." },
    { "role": "candidate",      "full_name": "...", "jobTitle": "..." },
    { "role": "candidate",      "full_name": "...", "jobTitle": "..." }
  ]
}

Rules:
- All company/supplier names: fictional DACH names only (no real companies)
- Supplier companies: staffing/recruitment agencies (e.g. "Performa Talent GmbH", "Nordstaff Solutions AG")
- Supplier emails: fictional domains (e.g. contact@performa-talent.de)
- Role labels: mix German/English naturally (e.g. "MSP Berater", "Einkaufsleiter")
- User names: realistic DACH names, varied gender and ethnicity`
    }],
  });

  const raw = (aiResponse.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
  const jsonStr = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ai: any;
  try {
    ai = JSON.parse(jsonStr);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse AI response');
    ai = JSON.parse(match[0]);
  }

  trackApiCall({
    purpose: 'Generate Test Client',
    model: 'claude-sonnet-4-6',
    inputTokens: aiResponse.usage.input_tokens,
    outputTokens: aiResponse.usage.output_tokens,
    context: `Company: ${ai?.company?.name ?? 'unknown'}`,
  });

  const { company, roleLabels, approvalConfig, users: aiUsers } = ai;
  const tempPassword = 'Test1234!';

  // Step 2: Create tenant
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({ name: company.name, slug: company.slug, active: true })
    .select()
    .single();
  if (tenantErr) throw new Error(tenantErr.message);
  const tenantId = (tenant as { id: string }).id;

  // Step 3: Tenant config
  const cfg = approvalConfig;
  await admin.from('tenant_configs').upsert({
    tenant_id: tenantId,
    demand_msp_review: true,
    demand_msp_screening: true,
    demand_approval_levels: cfg.demand_approval_levels ?? 2,
    demand_approval_role_l1: cfg.demand_approval_role_l1 ?? 'hiring_manager',
    demand_approval_role_l2: cfg.demand_approval_role_l2 ?? 'procurement',
    demand_approval_role_l3: cfg.demand_approval_role_l3 ?? null,
    award_msp_offer: true,
    award_po_step: true,
    award_approval_levels: cfg.award_approval_levels ?? 3,
    award_approval_role_l1: cfg.award_approval_role_l1 ?? 'procurement',
    award_approval_role_l2: cfg.award_approval_role_l2 ?? 'finance',
    award_approval_role_l3: cfg.award_approval_role_l3 ?? 'admin',
  }, { onConflict: 'tenant_id' });

  // Step 4: Tenant role labels
  const ROLE_KEYS = ['admin', 'recruiter', 'hiring_manager', 'procurement', 'finance', 'supplier', 'candidate'];
  await admin.from('tenant_roles').upsert(
    ROLE_KEYS.map(key => ({
      tenant_id: tenantId,
      role_key: key,
      label: roleLabels[key] ?? key,
      active: true,
    })),
    { onConflict: 'tenant_id,role_key' }
  );

  // Step 5: Create users
  const ts = Date.now();
  const createdUsers: GeneratedTenantUser[] = [];

  for (let i = 0; i < aiUsers.length; i++) {
    const u = aiUsers[i] as { role: string; full_name: string; jobTitle: string };
    const emailSuffix = u.full_name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
    const email = `micciche.alessandro+${emailSuffix}${ts + i}@gmail.com`;

    try {
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (authErr) continue;

      await admin.from('profiles').upsert({
        id: authData.user.id,
        email,
        full_name: u.full_name,
        role: u.role as 'admin' | 'hiring_manager' | 'recruiter' | 'candidate' | 'supplier' | 'procurement' | 'finance',
        tenant_id: tenantId,
      }, { onConflict: 'id' });

      createdUsers.push({
        role: u.role,
        configuredLabel: roleLabels[u.role] ?? u.role,
        full_name: u.full_name,
        jobTitle: u.jobTitle,
        email,
        password: tempPassword,
      });
    } catch { /* skip failed user, continue */ }
  }

  // Step 6: Create suppliers and assign to tenant
  const aiSuppliers = (ai.suppliers ?? []) as { company_name: string; contact_name: string; email: string; phone: string }[];
  const createdSuppliers: GeneratedTenantSupplier[] = [];
  const createdSupplierIds: string[] = [];
  for (const s of aiSuppliers) {
    try {
      const { data: supplier } = await admin
        .from('suppliers')
        .insert({ company_name: s.company_name, contact_name: s.contact_name, email: s.email, phone: s.phone, status: 'active' })
        .select('id')
        .single();
      if (supplier) {
        const sid = (supplier as { id: string }).id;
        createdSupplierIds.push(sid);
        await admin.from('tenant_suppliers').insert({ tenant_id: tenantId, supplier_id: sid, active: true });
        createdSuppliers.push({ company_name: s.company_name, contact_person: s.contact_name, email: s.email });
      }
    } catch { /* skip failed supplier */ }
  }

  // Link the generated supplier user to the first created supplier company so the
  // supplier portal shows as "Account linked" instead of erroring
  const supplierUserEmail = createdUsers.find(u => u.role === 'supplier')?.email;
  if (supplierUserEmail && createdSupplierIds.length > 0) {
    try {
      const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const supplierAuthUser = authList.users.find(u => u.email === supplierUserEmail);
      if (supplierAuthUser) {
        await admin.from('suppliers').update({ profile_id: supplierAuthUser.id }).eq('id', createdSupplierIds[0]);
      }
    } catch { /* non-blocking */ }
  }

  // Step 7: Generate 10 candidates via AI and distribute across suppliers
  let candidatesCreated = 0;
  if (createdSupplierIds.length > 0) {
    try {
      const candidateRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate 10 realistic DACH candidates for a staffing agency roster. Industry context: ${company.industry}.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "name": "Full Name",
    "headline": "Job title / specialisation",
    "phone": "+49 XX XXXXXXXX",
    "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
    "hourly_rate_min": 70,
    "hourly_rate_max": 110,
    "availability": "Sofort",
    "location": "München"
  }
]

Rules:
- 10 entries total
- Varied roles relevant to ${company.industry} (mix of IT, Finance, Engineering, HR, Operations)
- Realistic DACH first+last names, varied gender and ethnicity
- Hourly rates: junior 45–80, mid 80–130, senior 130–180 €/hr
- Availability: "Sofort" or a date like "01.09.2026"
- Locations: München, Berlin, Hamburg, Frankfurt, Wien, Zürich, Stuttgart, Köln, Düsseldorf, Dresden`,
        }],
      });

      trackApiCall({
        purpose: 'Generate Test Client — Candidates',
        model: 'claude-sonnet-4-6',
        inputTokens: candidateRes.usage.input_tokens,
        outputTokens: candidateRes.usage.output_tokens,
        context: `Company: ${company.name} · ${company.industry}`,
      });

      const rawCandidates = (candidateRes.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
      const jsonCandidates = rawCandidates.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let aiCandidates: any[] = [];
      try {
        aiCandidates = JSON.parse(jsonCandidates);
      } catch {
        const m = rawCandidates.match(/\[[\s\S]*\]/);
        if (m) aiCandidates = JSON.parse(m[0]);
      }

      const cTs = Date.now();
      for (let i = 0; i < aiCandidates.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = aiCandidates[i] as any;
        const supplierId = createdSupplierIds[i % createdSupplierIds.length]; // round-robin
        try {
          await admin.from('supplier_candidates').insert({
            supplier_id: supplierId,
            name: c.name,
            email: `micciche.alessandro+sc${cTs + i}@gmail.com`,
            phone: c.phone ?? null,
            headline: c.headline ?? null,
            skills: Array.isArray(c.skills) ? c.skills : [],
            hourly_rate_min: c.hourly_rate_min ?? null,
            hourly_rate_max: c.hourly_rate_max ?? null,
            currency: 'EUR',
            availability: c.availability ?? null,
            location: c.location ?? null,
          });
          candidatesCreated++;
        } catch { /* skip individual failures */ }
      }
    } catch { /* non-blocking — don't fail the whole generation */ }
  }

  revalidatePath('/dashboard/settings/tenants');
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);

  return {
    tenantId,
    tenantName: company.name,
    slug: company.slug,
    industry: company.industry,
    users: createdUsers,
    suppliers: createdSuppliers,
    candidatesCreated,
  };
}

export async function deleteTenant(tenantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') throw new Error('Only super_admin can delete tenants');

  const admin = createAdminClient();
  // Delete demands first — cascades: submissions, demand_suppliers, social_posts,
  // process_history, submission_interviews, engagements
  await admin.from('demands').delete().eq('tenant_id', tenantId);
  // Delete tenant — cascades: tenant_configs, tenant_roles, tenant_suppliers
  // profiles.tenant_id → SET NULL (users stay but become unassigned)
  const { error } = await admin.from('tenants').delete().eq('id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/settings/tenants');
  redirect('/dashboard/settings/tenants');
}

export async function removeUserFromTenant(userId: string, tenantId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ tenant_id: null })
    .eq('id', userId)
    .eq('tenant_id', tenantId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
  return { success: true };
}
