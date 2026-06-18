import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // 1. List all auth users with role=supplier in profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('role', 'supplier');

  console.log('Supplier profiles found:', profiles?.map(p => p.email));

  // 2. List all supplier records
  const { data: suppliers } = await admin
    .from('suppliers')
    .select('id, company_name, email, profile_id');

  console.log('\nSupplier records:');
  for (const s of suppliers ?? []) {
    console.log(`  ${s.company_name} | email: ${s.email} | profile_id: ${s.profile_id ?? 'NULL'}`);
  }

  // 3. For each supplier record with no profile_id, try to match by email
  console.log('\n🔗 Fixing missing profile_id links...');
  for (const s of suppliers ?? []) {
    if (s.profile_id) {
      console.log(`  ✓ ${s.company_name} already linked`);
      continue;
    }

    // Find a profile matching this supplier's email
    const match = profiles?.find(p => p.email === s.email);
    if (!match) {
      // Try auth users
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const authUser = users.find(u => u.email === s.email);
      if (!authUser) {
        console.log(`  ⚠️  No auth user found for ${s.email} (${s.company_name})`);
        continue;
      }

      // Ensure profile exists with supplier role
      await admin.from('profiles').upsert(
        { id: authUser.id, role: 'supplier', email: s.email },
        { onConflict: 'id' }
      );

      // Link supplier record
      const { error } = await admin
        .from('suppliers')
        .update({ profile_id: authUser.id })
        .eq('id', s.id);

      console.log(error
        ? `  ❌ Failed to link ${s.company_name}: ${error.message}`
        : `  ✓  Linked ${s.company_name} → ${authUser.email} (${authUser.id})`
      );
    } else {
      const { error } = await admin
        .from('suppliers')
        .update({ profile_id: match.id })
        .eq('id', s.id);

      console.log(error
        ? `  ❌ Failed to link ${s.company_name}: ${error.message}`
        : `  ✓  Linked ${s.company_name} → ${match.email} (${match.id})`
      );
    }
  }

  console.log('\n✅  Done.');
}

main();
