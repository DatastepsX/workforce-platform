'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] font-medium transition-colors ${
        active
          ? 'bg-[#007AFF]/10 text-[#007AFF]'
          : 'text-[#3C3C43] hover:bg-[#F2F2F7]'
      }`}
    >
      {children}
    </Link>
  );
}
