import Link from 'next/link';

export default function DemandNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-8">
      <div className="w-14 h-14 rounded-2xl bg-[#F2F2F7] flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-[#8E8E93]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="M9 12h6M9 16h4"/>
        </svg>
      </div>
      <h1 className="text-[22px] font-bold text-black mb-1">Demand not found</h1>
      <p className="text-[15px] text-[#8E8E93] text-center max-w-xs mb-6">
        This demand may have been deleted or you may not have access to it.
      </p>
      <Link
        href="/dashboard/demands"
        className="text-[15px] font-medium text-white px-5 py-2.5 rounded-xl"
        style={{ backgroundColor: '#007AFF' }}
      >
        Back to Demands
      </Link>
    </div>
  );
}
