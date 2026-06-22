'use client';

import { useState, useTransition } from 'react';
import { inviteUserToTenant, removeUserFromTenant } from '@/lib/actions/tenants';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', recruiter: 'Recruiter', hiring_manager: 'Hiring Manager',
  supplier: 'Supplier', candidate: 'Candidate',
};
const ROLE_COLORS: Record<string, string> = {
  admin: '#FF3B30', recruiter: '#007AFF', hiring_manager: '#FF9500',
  supplier: '#34C759', candidate: '#8E8E93',
};

interface TenantUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

interface Props {
  tenantId: string;
  users: TenantUser[];
}

export function UsersSection({ tenantId, users }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; existing?: boolean; tempPassword?: string; email?: string; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  function handleInvite(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await inviteUserToTenant(tenantId, formData);
      setResult(res ?? {});
      if (res?.success && !res.error) setShowForm(false);
    });
  }

  function handleRemove(userId: string) {
    setRemovingId(userId);
    startTransition(async () => {
      await removeUserFromTenant(userId, tenantId);
      setRemovingId(null);
    });
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px]">Users ({users.length})</p>
        <button
          onClick={() => { setShowForm(f => !f); setResult(null); setShowPassword(false); }}
          className="text-[13px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {/* Invite form */}
      {showForm && (
        <form action={handleInvite} className="bg-[#F2F2F7] rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Full Name</label>
              <input
                name="full_name"
                placeholder="Anna Schmidt"
                className="w-full px-3 py-2 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Email *</label>
              <input
                name="email"
                type="email"
                required
                placeholder="anna@company.com"
                className="w-full px-3 py-2 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#3C3C43] mb-1">Role *</label>
            <select
              name="role"
              required
              className="w-full h-9 px-3 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]"
            >
              <option value="">— select role —</option>
              <optgroup label="Client Roles">
                <option value="hiring_manager">Hiring Manager</option>
                <option value="procurement">Procurement</option>
                <option value="finance">Finance</option>
              </optgroup>
              <optgroup label="MSP Roles">
                <option value="recruiter">Recruiter / MSP Service</option>
                <option value="admin">Admin</option>
              </optgroup>
              <optgroup label="Other">
                <option value="supplier">Supplier</option>
                <option value="candidate">Candidate</option>
              </optgroup>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[12px] font-medium text-[#3C3C43]">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="text-[11px] text-[#007AFF] hover:opacity-70"
              >
                {showPassword ? 'Auto-generate' : 'Set password'}
              </button>
            </div>
            {showPassword ? (
              <input
                name="password"
                type="password"
                placeholder="Min 8 characters"
                minLength={8}
                className="w-full px-3 py-2 rounded-[8px] border border-[#E5E5EA] bg-white text-[14px] focus:outline-none focus:border-[#007AFF]"
              />
            ) : (
              <p className="text-[12px] text-[#8E8E93]">A temporary password will be generated and shown after creation.</p>
            )}
          </div>
          {result?.error && <p className="text-[13px] text-[#FF3B30]">{result.error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-[8px] text-white text-[13px] font-semibold disabled:opacity-40"
            style={{ backgroundColor: '#007AFF' }}
          >
            {isPending ? 'Creating…' : 'Create & Assign'}
          </button>
        </form>
      )}

      {/* Temp password reveal */}
      {result?.success && result.tempPassword && (
        <div className="bg-[#34C759]/8 border border-[#34C759]/25 rounded-xl p-4 mb-4">
          <p className="text-[13px] font-semibold text-[#1C7B3A] mb-1">User created — share these credentials:</p>
          <p className="text-[13px] text-black">Email: <span className="font-mono font-semibold">{result.email}</span></p>
          <p className="text-[13px] text-black">Temp password: <span className="font-mono font-semibold">{result.tempPassword}</span></p>
          <p className="text-[11px] text-[#8E8E93] mt-1">User should change their password on first login.</p>
        </div>
      )}
      {result?.success && result.existing && (
        <div className="bg-[#007AFF]/8 border border-[#007AFF]/25 rounded-xl p-3 mb-4">
          <p className="text-[13px] font-semibold text-[#007AFF]">Existing user assigned to this tenant.</p>
        </div>
      )}

      {/* User list */}
      {users.length === 0 ? (
        <p className="text-[14px] text-[#8E8E93] text-center py-4">No users assigned yet.</p>
      ) : (
        <div className="divide-y divide-[#F2F2F7]">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-black truncate">{u.full_name || u.email}</p>
                {u.full_name && <p className="text-[12px] text-[#8E8E93] truncate">{u.email}</p>}
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: (ROLE_COLORS[u.role] ?? '#8E8E93') + '18', color: ROLE_COLORS[u.role] ?? '#8E8E93' }}
                >
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                <button
                  onClick={() => handleRemove(u.id)}
                  disabled={removingId === u.id || isPending}
                  className="text-[12px] text-[#FF3B30] hover:opacity-70 transition-opacity disabled:opacity-30"
                >
                  {removingId === u.id ? '…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
