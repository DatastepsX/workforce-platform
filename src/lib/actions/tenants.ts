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
    cost_msp_review:        bool('cost_msp_review'),
    cost_hm_approval:       bool('cost_hm_approval'),
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
  laddersCreated: number;
  orgUnitsCreated: number;
  jobDescriptionsCreated: number;
  supplierCategoriesCreated: number;
  costItemsEnabled: boolean;
  error?: string;
}

export async function generateTestTenant(): Promise<GeneratedTenantResult> {
  await assertAdmin();
  const admin = createAdminClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Fetch existing tenant names so the AI avoids duplicates
  const { data: existingTenants } = await admin.from('tenants').select('name');
  const existingNames = (existingTenants ?? []).map(t => (t as { name: string }).name);
  const existingNamesList = existingNames.length > 0
    ? `\n\nALREADY EXISTS — DO NOT USE similar names to any of these:\n${existingNames.map(n => `  - ${n}`).join('\n')}`
    : '';

  // Step 1: Generate company + user data with Claude
  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Generate realistic test data for a DACH enterprise client on a Workforce Management Platform (MSP model).${existingNamesList}

Return ONLY valid JSON — no markdown, no explanation:
{
  "company": {
    "name": "Highly creative fictional DACH company name. Use compound words, acronyms, or industry-specific terms. Very different from any existing name. E.g. 'Falkentec Industrie AG', 'Quanterra Logistics GmbH', 'Meridian Pharma SE'.",
    "slug": "lowercase-kebab-no-umlauts",
    "industry": "Specific industry sector in English (e.g. 'Industrial Automation', 'Pharmaceutical Manufacturing', 'Financial Services', 'Logistics & Supply Chain')"
  },
  "roleLabels": {
    "admin": "MSP Admin or similar German/English mix",
    "recruiter": "MSP Berater or similar",
    "hiring_manager": "Fachbereichsleiter or similar",
    "procurement": "Einkaufsleiter or similar",
    "finance": "Finanzcontroller or similar",
    "supplier": "Lieferant or similar",
    "candidate": "Bewerber or similar"
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
  "supplierCategories": [
    { "name": "Category matching the industry", "description": "What specialists this covers" },
    { "name": "Second relevant category", "description": "What specialists this covers" },
    { "name": "Third relevant category", "description": "What specialists this covers" }
  ],
  "suppliers": [
    { "company_name": "fictional staffing agency name", "contact_name": "Full Name", "email": "contact@agency.de", "phone": "+49...", "category": "One of the supplierCategories names above" },
    { "company_name": "...", "contact_name": "...", "email": "...", "phone": "+49...", "category": "..." },
    { "company_name": "...", "contact_name": "...", "email": "...", "phone": "+49...", "category": "..." }
  ],
  "users": [
    { "role": "admin",          "full_name": "...", "jobTitle": "..." },
    { "role": "recruiter",      "full_name": "...", "jobTitle": "..." },
    { "role": "recruiter",      "full_name": "...", "jobTitle": "..." },
    { "role": "hiring_manager", "full_name": "...", "jobTitle": "...", "preferred_org_unit": "Engineering" },
    { "role": "hiring_manager", "full_name": "...", "jobTitle": "...", "preferred_org_unit": "Finance" },
    { "role": "hiring_manager", "full_name": "...", "jobTitle": "...", "preferred_org_unit": "Operations" },
    { "role": "procurement",    "full_name": "...", "jobTitle": "...", "preferred_org_unit": "Finance" },
    { "role": "finance",        "full_name": "...", "jobTitle": "...", "preferred_org_unit": "Finance" },
    { "role": "supplier",       "full_name": "...", "jobTitle": "..." },
    { "role": "candidate",      "full_name": "...", "jobTitle": "..." },
    { "role": "candidate",      "full_name": "...", "jobTitle": "..." }
  ]
}

Rules:
- Company name: extremely creative, fictional DACH compound name. Nothing generic. Zero similarity to existing names listed above.
- Industry: be very specific (not just "Technology" but "Industrial IoT & Automation")
- supplierCategories: 3 categories perfectly matched to the industry (e.g. for pharma: "Life Sciences Specialists", "Regulatory Affairs", "Clinical Operations")
- suppliers[].category: must exactly match one of the supplierCategories names
- preferred_org_unit for users: must match real org unit names that will be created (use industry-appropriate names)
- Supplier company names: fictional German/Swiss/Austrian staffing agencies
- User names: realistic DACH names, diverse gender and ethnicity`
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
  const aiSuppliers = (ai.suppliers ?? []) as { company_name: string; contact_name: string; email: string; phone: string; category?: string }[];
  const createdSuppliers: GeneratedTenantSupplier[] = [];
  const createdSupplierIds: string[] = [];
  const supplierCategoryAssignments: Record<string, string> = {}; // supplierId → categoryName
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
        if (s.category) supplierCategoryAssignments[sid] = s.category;
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

  // Step 6b: Create portal-level supplier categories + assign to tenant + link suppliers
  let supplierCategoriesCreated = 0;
  const aiSupplierCats = (ai.supplierCategories ?? []) as { name: string; description?: string }[];
  const catNameToId: Record<string, string> = {};
  for (const cat of aiSupplierCats) {
    if (!cat.name) continue;
    try {
      const { data: sc } = await admin
        .from('supplier_categories')
        .insert({ name: cat.name, description: cat.description ?? null, active: true })
        .select('id')
        .single();
      if (sc) {
        const catId = (sc as { id: string }).id;
        catNameToId[cat.name] = catId;
        await admin.from('tenant_supplier_categories').insert({ tenant_id: tenantId, supplier_category_id: catId });
        supplierCategoriesCreated++;
      }
    } catch { /* skip */ }
  }
  // Link each supplier to its assigned category
  for (const [supplierId, catName] of Object.entries(supplierCategoryAssignments)) {
    const catId = catNameToId[catName];
    if (catId) {
      try {
        await admin.from('supplier_category_members').insert({ supplier_id: supplierId, supplier_category_id: catId });
      } catch { /* skip */ }
    }
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

  // Step 8: Generate career ladders for this client's industry
  let laddersCreated = 0;
  try {
    const ladderRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Generate 3 career ladders for a ${company.industry} company called "${company.name}" on a workforce management platform.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "name": "Career path name",
    "industry": "Sector / specialism",
    "description": "One sentence describing this path",
    "steps": [
      { "position": 1, "title": "Entry-level title", "required_skills": ["skill1", "skill2"], "description": "Role description" },
      { "position": 2, "title": "Mid-level title", "required_skills": ["skill3", "skill4"], "description": "Role description" },
      { "position": 3, "title": "Senior title", "required_skills": ["skill5"], "description": "Role description" },
      { "position": 4, "title": "Lead / Principal title", "required_skills": ["skill6"], "description": "Role description" }
    ]
  }
]

Rules:
- Exactly 3 ladders, each with 4-5 steps
- Ladders should cover the core roles typical in ${company.industry}
- Skills should be realistic and relevant to the industry
- Titles in English, skills in English
- No generic ladders (avoid pure "Management" unless truly relevant)`
      }],
    });

    trackApiCall({
      purpose: 'Generate Test Client — Career Ladders',
      model: 'claude-sonnet-4-6',
      inputTokens: ladderRes.usage.input_tokens,
      outputTokens: ladderRes.usage.output_tokens,
      context: `Company: ${company.name} · ${company.industry}`,
    });

    const rawLadders = (ladderRes.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
    const jsonLadders = rawLadders.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aiLadders: any[] = [];
    try {
      aiLadders = JSON.parse(jsonLadders);
    } catch {
      const m = rawLadders.match(/\[[\s\S]*\]/);
      if (m) aiLadders = JSON.parse(m[0]);
    }

    for (const l of aiLadders) {
      try {
        const { data: ladder } = await admin.from('career_ladders').insert({
          name: l.name,
          industry: l.industry ?? null,
          description: l.description ?? null,
          tenant_id: tenantId,
        }).select('id').single();
        if (ladder && Array.isArray(l.steps)) {
          const lId = (ladder as { id: string }).id;
          await admin.from('career_ladder_steps').insert(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            l.steps.map((s: any, i: number) => ({
              ladder_id: lId,
              position: s.position ?? i + 1,
              title: s.title,
              required_skills: Array.isArray(s.required_skills) ? s.required_skills : [],
              description: s.description ?? null,
            }))
          );
          laddersCreated++;
        }
      } catch { /* skip failed ladder */ }
    }
  } catch { /* non-blocking */ }

  // Step 9: Generate org units + job descriptions
  let orgUnitsCreated = 0;
  let jobDescriptionsCreated = 0;
  try {
    const supplierCatNames = Object.keys(catNameToId);
    const jdRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Generate org units and EXACTLY 10 job description templates for "${company.name}", a ${company.industry} company.

Available supplier categories to link job descriptions to: ${supplierCatNames.length > 0 ? supplierCatNames.map(n => `"${n}"`).join(', ') : 'none'}

Return ONLY valid JSON — no markdown, no explanation:
{
  "orgUnits": [
    { "name": "Engineering", "description": "Software and systems engineering", "position": 1 },
    { "name": "Finance & Controlling", "description": "Financial planning and controlling", "position": 2 },
    { "name": "Operations", "description": "Production and operations management", "position": 3 }
  ],
  "jobDescriptions": [
    {
      "org_unit": "Engineering",
      "supplier_category": "IT & Technology",
      "title": "Senior Software Engineer",
      "description": "Develops and maintains mission-critical software systems. Works in agile teams on architecture decisions and code quality. Mentors junior developers.",
      "contract_type": "permanent",
      "skills": ["Java", "Spring Boot", "Kubernetes", "PostgreSQL", "CI/CD"],
      "budget_min": 80000,
      "budget_max": 115000,
      "experience_years": 5,
      "location": "Frankfurt, Germany",
      "remote_allowed": true
    }
  ]
}

Requirements:
- EXACTLY 3-5 org units relevant to ${company.industry}
- EXACTLY 10 job descriptions, well-distributed across org units (2-3 per unit)
- supplier_category must exactly match one of the available categories above (leave empty if none fits)
- Descriptions must be 2-3 realistic sentences, role-specific, not generic
- Skills: 4-6 per JD, industry-specific and realistic
- contract_type: "permanent" for most roles, "contractor" for project-based specialists, "freelance" for highly-specialized independent roles
- Budget ranges in EUR appropriate to seniority and contract type:
  - permanent: junior 45000-70000, mid 70000-95000, senior 95000-130000 annual
  - contractor: 500-1800 day rate
  - freelance: 60-200 hourly rate
- Locations: DACH cities (München, Berlin, Hamburg, Frankfurt, Wien, Zürich, Stuttgart, Köln)
- Make every JD realistic, role-specific, and suitable for ${company.industry}
- English titles and skills`,
      }],
    });

    trackApiCall({
      purpose: 'Generate Test Client — Org Units & Job Descriptions',
      model: 'claude-sonnet-4-6',
      inputTokens: jdRes.usage.input_tokens,
      outputTokens: jdRes.usage.output_tokens,
      context: `Company: ${company.name} · ${company.industry}`,
    });

    const rawJd = (jdRes.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
    const jsonJd = rawJd.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aiJd: any;
    try { aiJd = JSON.parse(jsonJd); } catch {
      const m = rawJd.match(/\{[\s\S]*\}/);
      if (m) aiJd = JSON.parse(m[0]);
    }

    if (aiJd?.orgUnits) {
      const orgUnitNameToId: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const u of aiJd.orgUnits as any[]) {
        try {
          const { data: ou } = await admin.from('org_units').insert({
            tenant_id: tenantId,
            name: u.name,
            description: u.description ?? null,
            active: true,
            position: u.position ?? 0,
          }).select('id').single();
          if (ou) {
            orgUnitNameToId[u.name] = (ou as { id: string }).id;
            orgUnitsCreated++;
          }
        } catch { /* skip */ }
      }

      // Auto-assign HM/procurement/finance users to org units based on AI preferred_org_unit
      // Fall back to round-robin if org unit name doesn't match
      const orgUnitIds = Object.values(orgUnitNameToId);
      let orgUnitRoundRobin = 0;
      for (const u of createdUsers) {
        if (!['hiring_manager', 'procurement', 'finance'].includes(u.role)) continue;
        try {
          const aiUser = (ai.users ?? []).find((au: { full_name: string }) => au.full_name === u.full_name) as { preferred_org_unit?: string } | undefined;
          const preferredName = aiUser?.preferred_org_unit;
          const orgUnitId = (preferredName && orgUnitNameToId[preferredName])
            ? orgUnitNameToId[preferredName]
            : orgUnitIds[orgUnitRoundRobin % orgUnitIds.length];
          if (orgUnitId) {
            // Find the auth user ID for this user by email
            const { data: profileRow } = await admin.from('profiles').select('id').eq('email', u.email).single();
            if (profileRow) {
              await admin.from('profiles').update({ org_unit_id: orgUnitId }).eq('id', (profileRow as { id: string }).id);
            }
          }
          orgUnitRoundRobin++;
        } catch { /* skip */ }
      }

      if (aiJd?.jobDescriptions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const jd of aiJd.jobDescriptions as any[]) {
          try {
            const orgUnitId = jd.org_unit ? (orgUnitNameToId[jd.org_unit] ?? null) : null;
            const { data: newJd } = await admin.from('job_descriptions').insert({
              tenant_id: tenantId,
              org_unit_id: orgUnitId,
              title: jd.title,
              description: jd.description ?? null,
              contract_type: jd.contract_type ?? 'permanent',
              skills: Array.isArray(jd.skills) ? jd.skills : [],
              budget_min: jd.budget_min ?? null,
              budget_max: jd.budget_max ?? null,
              experience_years: jd.experience_years ?? null,
              location: jd.location ?? null,
              remote_allowed: jd.remote_allowed ?? false,
              languages: [],
              active: true,
            }).select('id').single();
            if (newJd) {
              jobDescriptionsCreated++;
              // Link to supplier category if provided
              const catId = jd.supplier_category ? catNameToId[jd.supplier_category] : null;
              if (catId) {
                try {
                  await admin.from('jd_supplier_categories').insert({
                    job_description_id: (newJd as { id: string }).id,
                    supplier_category_id: catId,
                  });
                } catch { /* skip */ }
              }
            }
          } catch { /* skip */ }
        }
      }
    }
  } catch { /* non-blocking */ }

  // Step 10: Check whether cost items are configured on the platform
  let costItemsEnabled = false;
  try {
    const { count } = await admin.from('cost_items').select('id', { count: 'exact', head: true });
    costItemsEnabled = (count ?? 0) > 0;
  } catch { /* non-blocking */ }

  revalidatePath('/dashboard/settings/tenants');
  revalidatePath(`/dashboard/settings/tenants/${tenantId}`);
  revalidatePath('/dashboard/career-ladders');

  return {
    tenantId,
    tenantName: company.name,
    slug: company.slug,
    industry: company.industry,
    users: createdUsers,
    suppliers: createdSuppliers,
    candidatesCreated,
    laddersCreated,
    orgUnitsCreated,
    jobDescriptionsCreated,
    supplierCategoriesCreated,
    costItemsEnabled,
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
