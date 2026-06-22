'use client';

import { useState } from 'react';

const ROLE_META: Record<string, { label: string; color: string }> = {
  super_admin:    { label: 'Super Admin',     color: '#FF9500' },
  admin:          { label: 'Admin',           color: '#FF3B30' },
  recruiter:      { label: 'Recruiter',       color: '#007AFF' },
  hiring_manager: { label: 'Hiring Manager',  color: '#FF9500' },
  supplier:       { label: 'Supplier',        color: '#34C759' },
  candidate:      { label: 'Candidate',       color: '#8E8E93' },
  procurement:    { label: 'Procurement',     color: '#AF52DE' },
  finance:        { label: 'Finance',         color: '#30B0C7' },
};

const ROLE_ORDER = ['super_admin', 'admin', 'recruiter', 'hiring_manager', 'procurement', 'finance', 'supplier', 'candidate'];

interface UserOption {
  id: string;
  email: string;
  role: string;
  displayName: string;
  tenantName: string | null;
  configuredRoleLabel: string | null;
}

interface Props {
  switchAction: (formData: FormData) => Promise<void>;
  allUsers: UserOption[];
}

export function DevUserSwitcher({ switchAction, allUsers }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const close = () => { setOpen(false); setSelectedRole(null); };

  // Only show roles that actually have users
  const availableRoles = ROLE_ORDER.filter(r => allUsers.some(u => u.role === r));

  const usersForRole = selectedRole
    ? allUsers.filter(u => u.role === selectedRole).sort((a, b) => a.displayName.localeCompare(b.displayName))
    : [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide text-[#8E8E93] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors select-none"
      >
        DEV
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />

          <div className="absolute bottom-8 left-0 z-50 w-60 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.14)] border border-[#E5E5EA] overflow-hidden">

            {/* Step 1: Role picker */}
            {!selectedRole && (
              <>
                <div className="px-3 pt-2.5 pb-2 border-b border-[#F2F2F7]">
                  <p className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">Switch User · Select Role</p>
                </div>
                <div className="p-2 grid grid-cols-1 gap-1">
                  {availableRoles.map(role => {
                    const meta = ROLE_META[role] ?? { label: role, color: '#8E8E93' };
                    const count = allUsers.filter(u => u.role === role).length;
                    return (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F2F2F7] transition-colors text-left w-full"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                        <span className="text-[13px] font-semibold text-black flex-1">{meta.label}</span>
                        <span className="text-[11px] text-[#8E8E93] font-medium bg-[#F2F2F7] px-1.5 py-0.5 rounded-md">{count}</span>
                        <svg className="w-3.5 h-3.5 text-[#C7C7CC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Step 2: User list for selected role */}
            {selectedRole && (
              <>
                <div className="px-3 pt-2.5 pb-2 border-b border-[#F2F2F7] flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRole(null)}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#8E8E93] hover:bg-[#F2F2F7] transition-colors flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ROLE_META[selectedRole]?.color ?? '#8E8E93' }} />
                    <p className="text-[11px] font-semibold text-black truncate">{ROLE_META[selectedRole]?.label ?? selectedRole}</p>
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {usersForRole.length === 0 ? (
                    <p className="px-3 py-4 text-[12px] text-[#8E8E93] text-center">No users found</p>
                  ) : usersForRole.map(u => (
                    <form key={u.id} action={switchAction} onSubmit={close}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="email" value={u.email} />
                      <input type="hidden" name="role" value={u.role} />
                      <button type="submit" className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 hover:bg-[#F2F2F7] transition-colors">
                        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: ROLE_META[u.role]?.color ?? '#8E8E93' }}>
                          {u.displayName[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-black truncate leading-tight">{u.displayName}</p>
                          <p className="text-[10px] text-[#8E8E93] truncate leading-tight mt-0.5">
                            {u.tenantName ? (
                              <span className="text-[#007AFF] font-medium">{u.tenantName} · </span>
                            ) : null}
                            {u.configuredRoleLabel && u.configuredRoleLabel !== (ROLE_META[u.role]?.label ?? u.role) ? (
                              <span className="text-[#FF9500] font-medium">{u.configuredRoleLabel} · </span>
                            ) : null}
                            {u.email}
                          </p>
                        </div>
                      </button>
                    </form>
                  ))}
                </div>
              </>
            )}

            <div className="border-t border-[#F2F2F7] px-3 py-1.5">
              <p className="text-[10px] text-[#C7C7CC]">Magic link · fallback: Test1234!</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
