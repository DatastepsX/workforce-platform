import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createCareerLadder } from '@/lib/actions/career-ladders';

const INPUT = 'w-full h-11 px-4 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all';
const LABEL = 'block text-[13px] font-medium text-[#3C3C43] mb-1.5';

export default async function NewCareerLadderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single();
  if (!['super_admin', 'admin', 'recruiter'].includes(me?.role ?? '')) redirect('/dashboard');

  const isSuperAdmin = me?.role === 'super_admin';

  // super_admin needs to pick a tenant
  let tenants: { id: string; name: string }[] = [];
  if (isSuperAdmin) {
    const admin = createAdminClient();
    const { data } = await admin.from('tenants').select('id, name').eq('active', true).order('name');
    tenants = (data ?? []) as { id: string; name: string }[];
  }

  return (
    <div className="px-8 py-10 max-w-xl">
      <div className="flex items-center gap-3 text-[13px] text-[#8E8E93] mb-6">
        <Link href="/dashboard/career-ladders" className="hover:text-[#007AFF] transition-colors">Career Ladders</Link>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        <span className="text-black font-medium">New Ladder</span>
      </div>

      <h1 className="text-[28px] font-bold tracking-tight text-black mb-6">New Career Ladder</h1>

      <form action={createCareerLadder} className="space-y-4">
        {isSuperAdmin && (
          <div>
            <label className={LABEL}>Client *</label>
            <select name="tenant_id" required className={INPUT}>
              <option value="">— select a client —</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={LABEL}>Name *</label>
          <input type="text" name="name" required placeholder="e.g. Software Engineering" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Industry / Specialism</label>
          <input type="text" name="industry" placeholder="e.g. IT / Technology" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Description</label>
          <textarea name="description" rows={3} placeholder="Short description of this career path…"
            className="w-full px-4 py-3 rounded-[10px] border border-[#E5E5EA] bg-white text-[15px] placeholder-[#C7C7CC] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 resize-none transition-all" />
        </div>
        <p className="text-[12px] text-[#8E8E93]">
          Steps will be added in the next step after creation.
        </p>
        <div className="flex gap-3 pt-1">
          <button type="submit"
            className="h-11 px-6 rounded-2xl text-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#007AFF' }}>
            Create
          </button>
          <Link href="/dashboard/career-ladders"
            className="h-11 px-6 rounded-2xl border border-[#E5E5EA] text-[14px] font-medium text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors flex items-center">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
