import Link from 'next/link';

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Minimal navbar */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/careers" className="text-[17px] font-bold tracking-tight text-black">
            WorkforceX <span className="text-[#007AFF]">Careers</span>
          </Link>
          <Link
            href="/login"
            className="text-[14px] font-medium text-[#007AFF] hover:opacity-70 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {children}
      </main>

      <footer className="text-center py-8 text-[12px] text-[#C7C7CC]">
        Powered by WorkforceX
      </footer>
    </div>
  );
}
