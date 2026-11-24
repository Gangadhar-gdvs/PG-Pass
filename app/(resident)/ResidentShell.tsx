'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { BottomTabBar } from '@/components/ui/bottom-tab-bar';
import { IdleLogout } from '@/components/auth/IdleLogout';
import { Home, Search, LogOut, UserCircle } from 'lucide-react';

export function ResidentShell({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const router = useRouter();

  const signOut = () => {
    logout();
    router.push('/resident/login');
  };

  return (
    <div className="theme-resident min-h-screen app-gradient-tint flex flex-col pb-24">
      <IdleLogout role="resident" redirectTo="/resident/login" />
      {/* Gradient header band */}
      <header className="app-gradient px-5 pt-5 pb-6 rounded-b-[28px] shadow-[0_8px_24px_-12px_rgba(13,148,136,0.5)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-white/20 backdrop-blur flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-white text-[15px] leading-none">PGPass</div>
              <div className="text-white/70 text-[11px] font-semibold mt-0.5">Resident</div>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center press"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 text-white" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden px-4 -mt-3 max-w-2xl mx-auto w-full">
        <div className="animate-fade-up">{children}</div>
      </main>

      {/* Desktop nav is minimal for residents; primary nav is the floating bar */}
      <BottomTabBar
        primary={[
          { href: '/resident/home', label: 'My PGs', icon: Home },
          { href: '/resident/discover', label: 'Discover', icon: Search },
        ]}
        center={{ label: 'Find a PG', icon: Search, onClick: () => router.push('/resident/discover') }}
      />
    </div>
  );
}
