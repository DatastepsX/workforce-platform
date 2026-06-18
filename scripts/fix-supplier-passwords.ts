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
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const suppliers = users.filter(u => u.email?.includes('+supplier'));
  console.log(`Found ${suppliers.length} supplier user(s)`);

  for (const u of suppliers) {
    const { error } = await admin.auth.admin.updateUserById(u.id, {
      password: 'Test1234!',
      email_confirm: true,
    });
    console.log(error
      ? `  ❌  ${u.email}: ${error.message}`
      : `  ✓  ${u.email} — password set`
    );
  }
}

main();
