import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function IconBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {children}
    </div>
  );
}

function RowSeparator() {
  return <div className="ml-[58px] h-px bg-[#C6C6C8]" />;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const initial = user.email?.[0].toUpperCase() ?? "?";
  const provider =
    (user.app_metadata?.provider as string | undefined) ?? "email";
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="min-h-screen bg-[#F2F2F7] px-5 py-12">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[13px] font-medium text-[#8E8E93] mb-0.5">
              {getGreeting()}
            </p>
            <h1 className="text-[34px] font-bold tracking-tight text-black leading-tight">
              Dashboard
            </h1>
          </div>
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[18px] font-semibold select-none flex-shrink-0"
            style={{
              backgroundColor: "#007AFF",
              boxShadow: "0 4px 12px rgba(0,122,255,0.32)",
            }}
          >
            {initial}
          </div>
        </div>

        {/* Account section */}
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-1.5 ml-1">
          Account
        </p>
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-2">
          <div className="flex items-center px-4 py-3.5 gap-3">
            <IconBadge color="rgba(0,122,255,0.12)">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#007AFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </IconBadge>
            <span className="flex-1 text-[16px] text-black">Email</span>
            <span className="text-[16px] text-[#8E8E93] truncate max-w-[200px]">
              {user.email}
            </span>
          </div>
          <RowSeparator />
          <div className="flex items-center px-4 py-3.5 gap-3">
            <IconBadge color="rgba(0,122,255,0.12)">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#007AFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </IconBadge>
            <span className="flex-1 text-[16px] text-black">Provider</span>
            <span className="text-[16px] text-[#8E8E93] capitalize">
              {provider}
            </span>
          </div>
        </div>

        {/* Status section */}
        <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-1.5 ml-1 mt-5">
          Status
        </p>
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)] mb-2">
          <div className="flex items-center px-4 py-3.5 gap-3">
            <IconBadge color="rgba(52,199,89,0.12)">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#34C759" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </IconBadge>
            <span className="flex-1 text-[16px] text-black">Session</span>
            <span className="text-[16px] font-medium" style={{ color: "#34C759" }}>
              Active
            </span>
          </div>
          <RowSeparator />
          <div className="flex items-center px-4 py-3.5 gap-3">
            <IconBadge color="rgba(142,142,147,0.12)">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#8E8E93" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </IconBadge>
            <span className="flex-1 text-[16px] text-black">Last signed in</span>
            <span className="text-[16px] text-[#8E8E93]">{lastSignIn}</span>
          </div>
        </div>

        {/* Sign out */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_8px_rgba(0,0,0,0.06)] mt-8">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full py-4 text-[17px] font-medium text-[#FF3B30] hover:opacity-60 transition-opacity cursor-pointer"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
