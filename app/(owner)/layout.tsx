'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Building,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-[#64748B] font-medium">Loading Dashboard...</span>
      </div>
    );
  }

  if (!user) return null;

  const navLinks = [
    { href: '/dashboard', label: 'Bed Inventory', icon: LayoutDashboard },
    { href: '/tenants', label: 'Residents', icon: Users },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#09090B] flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 border-r border-[#E2E8F0] bg-white h-screen sticky top-0 px-4 py-5 shadow-xs">
        <div className="space-y-6">
          {/* Logo & Brand */}
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

          {/* Navigation Links */}
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

        {/* User Profile & Logout at Bottom */}
        <div className="border-t border-[#E2E8F0] pt-4 px-2 space-y-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={user.phoneNumber || 'Owner'} size="sm" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-[#09090B] block truncate">
                PG Owner
              </span>
              <span className="text-[11px] font-mono-numbers text-[#64748B] block truncate">
                {user.phoneNumber || '+91 Owner'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/login');
            }}
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
          <span className="font-bold text-sm tracking-tight text-[#09090B]">
            PGPass
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            logout();
            router.push('/login');
          }}
          className="p-1.5 rounded-[6px] text-[#64748B] hover:text-[#EF4444] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] px-4 py-2 flex justify-around items-center shadow-lg">
        {navLinks.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-[6px] transition-colors ${
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
  );
}
