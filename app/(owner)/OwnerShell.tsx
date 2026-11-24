'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { OwnerSessionProvider, OwnerSession } from '@/hooks/useOwner';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Building,
  CreditCard,
  UserCheck,
  BarChart3,
  Wrench,
  Wallet,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { PropertySwitcher } from '@/components/owner/PropertySwitcher';

// Full navigation (desktop sidebar).
const navLinks = [
  { href: '/dashboard', label: 'Bed Inventory', icon: LayoutDashboard },
  { href: '/tenants', label: 'Residents', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/expenses', label: 'Expenses', icon: Wallet },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/staff', label: 'Wardens & Staff', icon: UserCheck },
  { href: '/billing', label: 'Subscription', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// Primary items shown in the compact mobile bottom bar (kept to 5 to stay
// tappable). The rest are reachable from the mobile header's menu / desktop
// sidebar.
const mobileNav = [
  { href: '/dashboard', label: 'Beds', icon: LayoutDashboard },
  { href: '/tenants', label: 'Residents', icon: Users },
  { href: '/analytics', label: 'Stats', icon: BarChart3 },
  { href: '/maintenance', label: 'Issues', icon: Wrench },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/**
 * Client chrome for the owner area. Auth is already guaranteed by the server
 * layout, so there is no blocking "Loading…" gate here — the page renders
 * immediately and `useAuth` is used only for the interactive sign-out action.
 */
export function OwnerShell({
  session,
  children,
}: {
  session: OwnerSession;
  children: React.ReactNode;
}) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const signOut = () => {
    logout();
    router.push('/login');
  };

  const displayPhone = session.phoneNumber || '+91 Owner';

  return (
    <OwnerSessionProvider value={session}>
      <div className="min-h-screen bg-[#F8FAFC] text-[#09090B] flex flex-col md:flex-row pb-16 md:pb-0">
        {/* Desktop Left Sidebar */}
        <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 border-r border-[#E2E8F0] bg-white h-screen sticky top-0 px-4 py-5 shadow-xs">
          <div className="space-y-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-[8px] bg-[#D97706] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-[#09090B] block leading-none">
                  PGPass
                </span>
                <span className="text-[10px] font-semibold text-[#D97706] tracking-wide uppercase mt-0.5 block">
                  Owner Console
                </span>
              </div>
            </Link>

            <PropertySwitcher />

            <nav className="space-y-1">
              {navLinks.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-xs font-semibold transition-all ${
                      active
                        ? 'bg-[#FEF3C7] text-[#92400E] shadow-xs'
                        : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#09090B]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-[#D97706]' : 'text-[#94A3B8]'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4 px-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={displayPhone} size="sm" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-[#09090B] block truncate">PG Owner</span>
                <span className="text-[11px] font-mono-numbers text-[#64748B] block truncate">
                  {displayPhone}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[8px] border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#EF4444] hover:border-[#FECACA] transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Top Header */}
        <header className="md:hidden sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#D97706] text-white flex items-center justify-center font-bold text-xs">
              <Building className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm tracking-tight text-[#09090B]">PGPass</span>
          </div>

          <div className="flex items-center gap-2">
            <PropertySwitcher compact />
            <button
              type="button"
              onClick={signOut}
              className="p-1.5 rounded-[6px] text-[#64748B] hover:text-[#EF4444] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area.
            Bottom padding clears the fixed mobile nav (~68px) + the device
            home-indicator safe area so content is never hidden behind it. */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] px-4 py-2 flex justify-around items-center shadow-lg"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        >
          {mobileNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] py-1 px-4 rounded-[6px] transition-colors ${
                  active ? 'text-[#D97706] font-bold' : 'text-[#64748B] font-medium'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] tracking-tight">{item.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-[#D97706]" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </OwnerSessionProvider>
  );
}
