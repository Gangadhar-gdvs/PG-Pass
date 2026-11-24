'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Home, Search, LogOut, UserCircle } from 'lucide-react';

const nav = [
  { href: '/resident/home', label: 'My PGs', icon: Home },
  { href: '/resident/discover', label: 'Find a PG', icon: Search },
];

export function ResidentShell({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const signOut = () => {
    logout();
    router.push('/resident/login');
  };

  return (
    <div className="min-h-screen bg-[#F0FDFA] text-[#09090B] flex flex-col pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#CCFBF1] px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[6px] bg-[#0D9488] text-white flex items-center justify-center">
            <UserCircle className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight">PGPass · Resident</span>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="p-1.5 rounded-[6px] text-[#64748B] hover:text-[#DC2626] hover:bg-[#F8FAFC] transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 overflow-x-hidden p-4 max-w-2xl mx-auto w-full pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#CCFBF1] px-4 py-2 flex justify-around items-center shadow-lg"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] px-6 rounded-[8px] transition-colors ${
                active ? 'text-[#0D9488] font-bold' : 'text-[#64748B]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
