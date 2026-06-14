"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-8">
      <div className="w-full max-w-sm">
        {/* App icon mark */}
        <div
          className="w-20 h-20 rounded-[20px] flex items-center justify-center mb-5 select-none"
          style={{
            backgroundColor: "#007AFF",
            boxShadow: "0 8px 24px rgba(0,122,255,0.38)",
          }}
        >
          <span className="text-white font-bold text-[38px] leading-none tracking-[-1px]">
            W
          </span>
        </div>

        <h1 className="text-[34px] font-bold tracking-tight text-black mb-1.5">
          Workforce
        </h1>
        <p className="text-[15px] text-[#8E8E93] mb-10">
          Sign in to your account
        </p>

        <form onSubmit={handleLogin} className="flex flex-col gap-2.5">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-[#F2F2F7] rounded-xl px-4 py-4 text-[17px] text-black placeholder:text-[#8E8E93] outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full bg-[#F2F2F7] rounded-xl px-4 py-4 text-[17px] text-black placeholder:text-[#8E8E93] outline-none border-[1.5px] border-transparent focus:border-[#007AFF] focus:bg-white transition-colors"
          />

          {error && (
            <p className="text-[13px] text-[#FF3B30] pt-0.5">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white text-[17px] font-semibold rounded-[14px] h-14 mt-1 transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-60 cursor-pointer"
            style={{
              backgroundColor: "#007AFF",
              boxShadow: "0 6px 20px rgba(0,122,255,0.32)",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
