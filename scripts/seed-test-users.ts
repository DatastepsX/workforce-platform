import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'Test1234!';

const USERS = [
  { email: 'micciche.alessandro+admin@gmail.com',     role: 'admin',          full_name: 'Alessandro Admin' },
  { email: 'micciche.alessandro+recruiter@gmail.com', role: 'recruiter',      full_name: 'Rosa Recruiter' },
  { email: 'micciche.alessandro+hiring@gmail.com',    role: 'hiring_manager', full_name: 'Hans Hiring' },
  { email: 'micciche.alessandro+supplier@gmail.com',  role: 'supplier',       full_name: 'Stefan Supplier' },
  { email: 'micciche.alessandro+candidate@gmail.com', role: 'candidate',      full_name: 'Clara Candidate' },
] as const;

async function upsertUser(entry: typeof USERS[number]) {
  const { email, role, full_name } = entry;

  // 1. Try to create; if already exists, look up by email
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name },
  });

  let userId: string;

  if (createErr) {
    if (!createErr.message.toLowerCase().includes('already')) {
      throw new Error(`createUser failed for ${email}: ${createErr.message}`);
    }
    // User exists — fetch their ID
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find(u => u.email === email);
    if (!existing) throw new Error(`Could not find existing user ${email}`);
    userId = existing.id;
    // Update password to make sure it matches
    await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
    console.log(`  ↩  ${email} already exists — updated password`);
  } else {
    userId = created.user!.id;
    console.log(`  ✓  Created ${email} (${userId})`);
  }

  // 2. Upsert profile with correct role
  const { error: profileErr } = await admin.from('profiles').upsert(
    { id: userId, role, full_name, email },
    { onConflict: 'id' },
  );
  if (profileErr) throw new Error(`Profile upsert failed for ${email}: ${profileErr.message}`);

  // 3. For supplier: ensure a suppliers record exists linked to this profile
  if (role === 'supplier') {
    const { data: existing } = await admin
      .from('suppliers')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (!existing) {
      const { error: supplierErr } = await admin.from('suppliers').insert({
        company_name: 'Test Supplier GmbH',
        contact_name: full_name,
        email,
        specializations: ['IT', 'Engineering'],
        status: 'active',
        profile_id: userId,
      });
      if (supplierErr) throw new Error(`Supplier insert failed: ${supplierErr.message}`);
      console.log(`  ✓  Supplier record created for ${email}`);
    } else {
      // Make sure profile_id is linked
      await admin.from('suppliers').update({ profile_id: userId }).eq('id', existing.id);
      console.log(`  ↩  Supplier record already exists for ${email}`);
    }
  }
}

async function main() {
  console.log('🌱  Seeding test users…\n');
  for (const user of USERS) {
    console.log(`→ ${user.role.padEnd(15)} ${user.email}`);
    try {
      await upsertUser(user);
    } catch (err) {
      console.error(`  ❌  ${(err as Error).message}`);
    }
  }
  console.log('\n✅  Done. Login at /login with password: Test1234!');
}

main();
