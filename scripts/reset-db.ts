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

// Emails to KEEP (admin + hiring manager)
const KEEP_EMAILS = new Set([
  'micciche.alessandro+admin@gmail.com',
  'micciche.alessandro+hiring@gmail.com',
]);

async function resetDb() {
  console.log('🗑️   Resetting database…\n');

  // 1. Clear all business data (order matters for FK constraints)
  const tables = [
    'candidate_submissions',
    'supplier_candidates',
    'candidate_profiles',
    'demand_suppliers',
    'demands',
    'suppliers',
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`  ❌  Failed to clear ${table}: ${error.message}`);
    } else {
      console.log(`  ✓  Cleared ${table}`);
    }
  }

  // 2. Delete auth users that are NOT in KEEP_EMAILS
  console.log('\n🔑  Removing test users (keeping admin + hiring manager)…');
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error(`  ❌  Could not list users: ${listErr.message}`);
    return;
  }

  const toDelete = users.filter(u => u.email && !KEEP_EMAILS.has(u.email));

  for (const u of toDelete) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) {
      console.error(`  ❌  Could not delete ${u.email}: ${error.message}`);
    } else {
      console.log(`  ✓  Deleted ${u.email}`);
    }
  }

  console.log('\n✅  Done. Database is clean. Kept:');
  for (const email of KEEP_EMAILS) {
    console.log(`     ${email}`);
  }
}

resetDb();
