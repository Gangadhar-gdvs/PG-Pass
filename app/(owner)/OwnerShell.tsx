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
  BedDouble,
  LifeBuoy,
  Megaphone,
  ClipboardList,
  FileText,
  DoorOpen,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { PropertySwitcher } from '@/components/owner/PropertySwitcher';
import { OwnerTopBar } from '@/components/owner/OwnerTopBar';
import { BottomTabBar } from '@/components/ui/bottom-tab-bar';
import { IdleLogout } from '@/components/auth/IdleLogout';

const navLinks = [
  { href: '/dashboard', label: 'Bed Inventory', icon: LayoutDashboard },
  { href: '/tenants', label: 'Residents', icon: Users },
  { href: '/guests', label: 'Guests', icon: BedDouble },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/expenses', label: 'Expenses', icon: Wallet },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/visitors', label: 'Visitors', icon: DoorOpen },
  { href: '/notices', label: 'Notices', icon: Megaphone },
  { href: '/staff', label: 'Wardens & Staff', icon: UserCheck },
  { href: '/billing', label: 'Subscription', icon: CreditCard },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// Pages a staff/warden must not see — these mutate owner-only data (profile,
// subscription, staff roster) and are already blocked server-side. Hiding them
// from the nav keeps the staff console to day-to-day operations only.
const OWNER_ONLY_HREFS = new Set(['/settings', '/billing', '/staff', '/reports']);

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

  const isStaff = session.role === 'staff';
  const visibleFor = <T extends { href: string }>(items: T[]) =>
    isStaff ? items.filter((i) => !OWNER_ONLY_HREFS.has(i.href)) : items;

  const signOut = async () => {
    await logout();
    // Full document navigation (not router.push) so the browser does NOT serve
    // the authenticated owner shell from bfcache when the user navigates back or
    // reopens the tab. `replace` also drops the owner page from history.
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    } else {
      router.replace('/login');
    }
  };

  const displayPhone = session.phoneNumber || '+91 Owner';

  return (
    <OwnerSessionProvider value={session}>
      <IdleLogout role={session.role} redirectTo="/login" />
      <div className="theme-owner min-h-screen app-gradient-tint text-slate-900 flex flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 bg-white h-screen sticky top-0 px-4 py-5 shadow-[0_0_24px_-12px_rgba(15,23,42,0.1)] border-r border-slate-100">
          <div className="space-y-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
              <div className="w-9 h-9 rounded-[12px] accent-bg flex items-center justify-center shadow-sm">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight block leading-none">PGPass</span>
                <span className="text-[10px] font-bold accent-text tracking-wider uppercase mt-0.5 block">
                  Owner Console
                </span>
              </div>
            </Link>

            <PropertySwitcher />

            <nav className="space-y-1">
              {visibleFor(navLinks).map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-sm font-bold transition-all press"
                    style={
                      active
                        ? { background: 'var(--accent-tint)', color: 'var(--accent)' }
                        : { color: '#64748B' }
                    }
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-slate-100 pt-4 px-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={displayPhone} size="sm" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold block truncate">PG Owner</span>
                <span className="text-[11px] font-mono-numbers text-slate-500 block truncate">{displayPhone}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-[12px] border-2 border-slate-200 text-xs font-bold text-slate-500 hover:bg-[#FEF2F2] hover:text-[#EF4444] hover:border-[#FECACA] transition-colors press"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main column. On mobile a sticky top bar (PG name + profile avatar)
            gives fixed-header behaviour, direct profile access, and a home for
            the property switcher; desktop uses the sidebar. */}
        <div className="flex-1 flex flex-col min-w-0 max-w-7xl w-full">
          <OwnerTopBar onSignOut={signOut} />

          {/* `pb-24` on mobile reserves room for the fixed bottom tab bar WITHOUT
              adding height on top of the full-screen container (which previously
              forced every page to scroll even with little content). */}
          <main className="flex-1 overflow-x-hidden px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8 pb-24 md:pb-8 w-full">
            <div className="animate-fade-up">{children}</div>
          </main>
        </div>

        {/* Floating bottom tab bar — essentials with the active tab shown as a
            floating pill; everything else lives in "More". No center "+". */}
        <BottomTabBar
          primary={[
            { href: '/dashboard', label: 'Beds', icon: LayoutDashboard },
            { href: '/tenants', label: 'Residents', icon: Users },
            { href: '/analytics', label: 'Stats', icon: BarChart3 },
            { href: '/maintenance', label: 'Issues', icon: Wrench },
          ]}
          more={visibleFor([
            { href: '/guests', label: 'Guests', icon: BedDouble },
            { href: '/tasks', label: 'Tasks', icon: ClipboardList },
            { href: '/visitors', label: 'Visitors', icon: DoorOpen },
            { href: '/notices', label: 'Notices', icon: Megaphone },
            { href: '/reports', label: 'Reports', icon: FileText },
            { href: '/expenses', label: 'Expenses', icon: Wallet },
            { href: '/staff', label: 'Staff', icon: UserCheck },
            { href: '/billing', label: 'Billing', icon: CreditCard },
            { href: '/support', label: 'Support', icon: LifeBuoy },
            { href: '/settings', label: 'Settings', icon: Settings },
          ])}
          footer={
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-500 hover:bg-[#FEF2F2] hover:text-[#EF4444] hover:border-[#FECACA] transition-colors press"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          }
        />
      </div>
    </OwnerSessionProvider>
  );
}
