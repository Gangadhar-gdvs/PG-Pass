'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSessionExpiryRedirect } from '@/hooks/useSessionExpiryRedirect';
import { BottomTabBar } from '@/components/ui/bottom-tab-bar';
import { IdleLogout } from '@/components/auth/IdleLogout';
import { Avatar } from '@/components/ui/avatar';
import { Drawer } from '@/components/ui/drawer';
import { Logo } from '@/components/brand/Logo';
import { Icon3D } from '@/components/brand/Icon3D';
import { Home, Search, LogOut, ChevronDown, Compass } from 'lucide-react';

export function ResidentShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // A 401 from any API call (expired/revoked session) reloads → server layout
  // redirects to /resident/login instead of the resident being stuck.
  useSessionExpiryRedirect();
  // Only Home gets the app bar; other pages show their own sticky PageHeader.
  const isHome = pathname === '/resident/home';
  const [profileOpen, setProfileOpen] = useState(false);

  const signOut = () => {
    logout();
    router.push('/resident/login');
  };

  const name = user?.displayName || user?.phoneNumber || 'Resident';

  return (
    <div className="theme-resident min-h-screen flex flex-col">
      <IdleLogout role="resident" redirectTo="/resident/login" />

      {/* Top bar — logo left, profile right (reference layout). Home only. */}
      {isHome && (
      <header
        className="sticky top-0 z-30 rounded-b-[26px] border-b border-[#EEE8FD] bg-white shadow-[0_10px_30px_-14px_rgba(70,40,160,0.30)]"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))', paddingBottom: '0.625rem' }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4">
          <Link href="/resident/home" className="press" aria-label="PGPass home">
            <Logo size={36} />
          </Link>
          <div className="flex items-center gap-2.5">
            <Link
              href="/resident/discover"
              className="hidden sm:inline-flex h-11 items-center gap-1.5 rounded-full bg-white/90 border border-white px-4 text-[13px] font-bold text-ink-2 shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)] hover:text-brand-700 press"
            >
              <Compass className="h-4 w-4 text-brand" /> Discover PGs
            </Link>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-1 rounded-full press"
              aria-label="Open profile menu"
            >
              <Avatar name={name} size="md" />
              <ChevronDown className="h-4 w-4 text-ink-2" />
            </button>
          </div>
        </div>
      </header>
      )}

      {/* overflow-x-CLIP keeps sticky page headers working (hidden would not). */}
      <main
        className={`flex-1 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] max-w-2xl mx-auto w-full ${
          isHome ? 'pt-2' : 'pt-[max(0.5rem,env(safe-area-inset-top))]'
        }`}
      >
        <div className="animate-fade-up">{children}</div>
      </main>

      <BottomTabBar
        primary={[
          { href: '/resident/home', label: 'Home', icon: Home },
          { href: '/resident/discover', label: 'Discover', icon: Compass },
        ]}
        center={{ label: 'Find a PG', icon: Search, onClick: () => router.push('/resident/discover') }}
      />

      <Drawer isOpen={profileOpen} onClose={() => setProfileOpen(false)} title="Profile" width="sm">
        <div className="space-y-4">
          <div className="app-card flex items-center gap-3 p-4">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold text-ink">{user?.displayName || 'Resident'}</span>
              {user?.phoneNumber && (
                <span className="block truncate font-mono-numbers text-[13px] font-medium text-muted">{user.phoneNumber}</span>
              )}
            </div>
          </div>
          <Link
            href="/resident/discover"
            onClick={() => setProfileOpen(false)}
            className="tint-card tint-sky flex items-center gap-3 p-4 press"
          >
            <Icon3D name="home-blue" size={38} />
            <div className="min-w-0">
              <span className="block text-[15px] font-extrabold text-ink">Discover PGs</span>
              <span className="block text-xs font-medium text-ink-2/75">Find and join a PG near you</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#EEE8FD] bg-white py-3 text-sm font-bold text-ink-2 shadow-[0_6px_14px_-10px_rgba(70,40,160,0.4)] transition-colors hover:bg-danger-bg hover:text-danger-ink press"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </Drawer>
    </div>
  );
}
