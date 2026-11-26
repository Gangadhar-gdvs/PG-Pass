'use client';

import React from 'react';
import { useOwnerAvatarUrl } from '@/lib/client/ownerAvatar';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { OwnerSessionProvider, OwnerSession } from '@/hooks/useOwner';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
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
  Plus,
  Zap,
  Package,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { PropertySwitcher } from '@/components/owner/PropertySwitcher';
import { OwnerTopBar } from '@/components/owner/OwnerTopBar';
import { BottomTabBar, type TabItem } from '@/components/ui/bottom-tab-bar';
import { IdleLogout } from '@/components/auth/IdleLogout';
import { Logo } from '@/components/brand/Logo';
import { Icon3D } from '@/components/brand/Icon3D';

const navLinks: TabItem[] = [
  { href: '/dashboard', label: 'Bed Inventory', icon: LayoutDashboard, icon3d: 'bed', tint: 'sky' },
  { href: '/tenants', label: 'Residents', icon: Users, icon3d: 'users', tint: 'violet' },
  { href: '/guests', label: 'Guests', icon: BedDouble, icon3d: 'bed-teal', tint: 'mint' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, icon3d: 'chart', tint: 'violet' },
  { href: '/reports', label: 'Reports', icon: FileText, icon3d: 'report', tint: 'indigo' },
  { href: '/expenses', label: 'Expenses', icon: Wallet, icon3d: 'wallet-orange', tint: 'peach' },
  { href: '/utilities', label: 'Utilities', icon: Zap, icon3d: 'bolt', tint: 'amber' },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench, icon3d: 'wrench', tint: 'sky' },
  { href: '/inventory', label: 'Room Inventory', icon: Package, icon3d: 'tools', tint: 'indigo' },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList, icon3d: 'doc-green', tint: 'mint' },
  { href: '/visitors', label: 'Visitors', icon: DoorOpen, icon3d: 'user-add', tint: 'sky' },
  { href: '/notices', label: 'Notices', icon: Megaphone, icon3d: 'megaphone', tint: 'violet' },
  { href: '/staff', label: 'Wardens & Staff', icon: UserCheck, icon3d: 'staff', tint: 'indigo' },
  { href: '/billing', label: 'Subscription', icon: CreditCard, icon3d: 'rupee', tint: 'mint' },
  { href: '/support', label: 'Support', icon: LifeBuoy, icon3d: 'bell-purple', tint: 'violet' },
  { href: '/settings', label: 'Settings', icon: Settings, icon3d: 'tools-purple', tint: 'slate' },
];

const byHref = (href: string) => navLinks.find((l) => l.href === href)!;

// Pages a staff/warden must not see — these mutate owner-only data (profile,
// subscription, staff roster) and are already blocked server-side. Hiding them
// from the nav keeps the staff console to day-to-day operations only.
const OWNER_ONLY_HREFS = new Set(['/settings', '/billing', '/staff', '/reports', '/utilities']);

export function OwnerShell({
  session,
  children,
}: {
  session: OwnerSession;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
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
  // Prefer the person's name for avatar initials; fall back to the phone.
  const avatarName = user?.displayName || displayPhone;

  // Owner profile picture (private storage → short-lived URL). Staff keep initials.
  const avatarUrl = useOwnerAvatarUrl(!isStaff);

  return (
    <OwnerSessionProvider value={session}>
      <IdleLogout role={session.role} redirectTo="/login" />
      <div className="theme-owner min-h-screen text-ink flex flex-col md:flex-row">
        {/* Desktop sidebar — floating frosted panel */}
        <aside className="hidden md:flex sticky top-0 h-screen w-[272px] shrink-0 p-4 pr-0">
          <div className="app-card flex h-full w-full flex-col justify-between overflow-hidden rounded-[28px] p-4">
            <div className="flex min-h-0 flex-col gap-5">
              <Link href="/dashboard" className="flex items-center gap-2 px-1.5 pt-1" aria-label="PGPass home">
                <Logo size={38} />
              </Link>

              <div className="flex items-center gap-2 rounded-2xl bg-[image:var(--grad-brand-soft)] px-3 py-2.5 border border-white">
                <Icon3D name="building" size={26} />
                <div className="min-w-0">
                  <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-700/80">
                    {isStaff ? 'Staff Console' : 'Owner Console'}
                  </span>
                  <span className="block text-[13px] font-bold text-ink truncate">Manage your PG</span>
                </div>
              </div>

              <PropertySwitcher />

              <nav className="-mx-1 flex min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-2 no-scrollbar" aria-label="Owner">
                {visibleFor(navLinks).map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-bold transition-all press ${
                        active
                          ? 'bg-[image:var(--grad-brand)] text-white shadow-[0_10px_20px_-10px_rgba(106,43,234,0.65),inset_0_1px_0_rgba(255,255,255,0.3)]'
                          : 'text-ink-2 hover:bg-brand-50 hover:text-brand-700'
                      }`}
                    >
                      <Icon
                        className={`h-[19px] w-[19px] shrink-0 ${active ? 'text-white' : 'text-[#8E88B8] group-hover:text-brand'}`}
                        strokeWidth={active ? 2.3 : 2}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-3 border-t border-line pt-4">
              <div className="flex items-center gap-2.5 px-1">
                <Avatar name={avatarName} src={avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{isStaff ? 'Warden / Staff' : 'PG Owner'}</span>
                  <span className="block truncate font-mono-numbers text-[11.5px] font-medium text-muted">{displayPhone}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#EEE8FD] bg-white/80 py-2.5 text-[13px] font-bold text-ink-2 shadow-[0_6px_14px_-10px_rgba(70,40,160,0.4)] transition-colors hover:border-danger-line hover:bg-danger-bg hover:text-danger-ink press"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main column. On mobile a sticky top bar (logo + notices + profile)
            gives fixed-header behaviour; desktop uses the sidebar. */}
        <div className="flex-1 flex flex-col min-w-0 max-w-7xl w-full">
          <OwnerTopBar onSignOut={signOut} avatarUrl={avatarUrl} avatarName={avatarName} />

          {/* `pb-28` on mobile reserves room for the fixed bottom nav + FAB. */}
          <main className="flex-1 overflow-x-hidden px-4 sm:px-6 lg:px-8 pt-2 pb-28 md:py-7 w-full">
            <div className="animate-fade-up">{children}</div>
          </main>
        </div>

        {/* Bottom navigation — Home · Residents · (+) · Stats · More, like the refs. */}
        <BottomTabBar
          primary={[
            { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
            { href: '/tenants', label: 'Residents', icon: Users },
            { href: '/analytics', label: 'Stats', icon: BarChart3 },
          ]}
          center={{
            label: 'Quick Actions',
            icon: Plus,
            items: visibleFor([
              { ...byHref('/dashboard'), label: 'Beds & Rent', icon3d: 'bed', tint: 'sky' },
              { ...byHref('/maintenance'), icon3d: 'wrench-orange', tint: 'peach' },
              { ...byHref('/expenses'), icon3d: 'wallet', tint: 'violet' },
              { ...byHref('/notices'), icon3d: 'bell', tint: 'peach' },
              { ...byHref('/guests'), icon3d: 'bed-teal', tint: 'mint' },
              { ...byHref('/visitors'), icon3d: 'user-add', tint: 'sky' },
            ]),
          }}
          more={visibleFor(
            navLinks.filter((l) => !['/dashboard', '/tenants', '/analytics'].includes(l.href))
          )}
          footer={
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#EEE8FD] bg-white py-3 text-sm font-bold text-ink-2 shadow-[0_6px_14px_-10px_rgba(70,40,160,0.4)] transition-colors hover:bg-danger-bg hover:text-danger-ink press"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          }
        />
      </div>
    </OwnerSessionProvider>
  );
}
