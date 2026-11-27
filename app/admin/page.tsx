'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  Mail,
  LogOut,
  Copy,
  Bug,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  Bell,
  ChevronDown,
  LayoutGrid,
  CreditCard,
  CheckCircle2,
  Globe,
  Zap,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { AdminSupportPanel } from '@/components/support/AdminSupportPanel';
import { AdminPgFeatures } from '@/components/admin/AdminPgFeatures';
import { AdminPgManage } from '@/components/admin/AdminPgManage';
import { AdminUsersPanel } from '@/components/admin/AdminUsersPanel';
import { IdleLogout } from '@/components/auth/IdleLogout';
import { clearLocalData } from '@/lib/client/localData';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input, SearchInput } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { Drawer } from '@/components/ui/drawer';
import { formatCurrency, errorMessage, readApiError } from '@/lib/utils';
import { apiGet, apiPost, apiPatch } from '@/lib/client/api';
import type { SuperAdminPgOverview } from '@/lib/server/services/adminOverview.service';
import type { SubscriptionRequest } from '@/types';
import { config } from '@/lib/config';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TabBar } from '@/components/ui/tab-bar';
import { StatGridSkeleton, ListSkeleton } from '@/components/ui/skeletons';
import { DataTable, Column } from '@/components/ui/data-table';
import {
  HeroHeader,
  PageHeader,
  StatTile,
  QuickActionGrid,
  SectionCard,
  SectionHeader,
  DonutChart,
  InfoBanner,
  KeyValue,
  type QuickAction,
} from '@/components/ui/dashboard-kit';
import { Logo } from '@/components/brand/Logo';
import { Illustration } from '@/components/brand/Illustration';
import { IconBubble, IconTile, GlyphTile } from '@/components/brand/Icon3D';
import { Tenant } from '@/types';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { copyText } from '@/lib/client/clipboard';
import { useConfirm } from '@/components/ui/confirm-dialog';

/** A system/error log row returned by /api/admin/logs. */
interface SystemLog {
  id: string;
  level: string;
  source?: string;
  code?: string;
  route?: string;
  message?: string;
  createdAt?: string | number;
  requestId?: string;
  details?: unknown;
  stack?: string;
  userAgent?: string;
}

type AdminTab = 'telemetry' | 'upgrades' | 'logs' | 'support' | 'admins';

interface PlatformStats {
  allPgs: SuperAdminPgOverview[];
  platformTotalPgs: number;
  platformTotalBeds: number;
  platformTotalResidents: number;
  platformTotalVolume: number;
  nextCursor?: string | null;
}

/** One console section, as shown in the desktop pill tabs and the mobile bottom nav. */
interface AdminTabDef {
  id: AdminTab;
  /** Pill-tab label (md+). */
  label: string;
  /** Bottom-nav label (phones). */
  short: string;
  icon: LucideIcon;
  count?: number;
  countTone?: 'brand' | 'danger';
}

/** Pastel fill per bed status for the occupancy matrix (+ legend). */
const BED_STATUS_STYLE: Record<string, { cls: string; dot: string; label: string }> = {
  paid: { cls: 'bg-success-bg text-success-ink ring-success-line', dot: 'bg-success', label: 'Paid' },
  pending: { cls: 'bg-warning-bg text-warning-ink ring-warning-line', dot: 'bg-warning', label: 'Pending' },
  verify: { cls: 'bg-brand-100 text-brand-700 ring-brand-200', dot: 'bg-brand', label: 'Verifying' },
  occupied: { cls: 'bg-info-bg text-info-ink ring-info-line', dot: 'bg-info', label: 'Occupied' },
  guest: { cls: 'bg-brand-50 text-brand-600 ring-brand-100', dot: 'bg-brand-300', label: 'Guest' },
  maintenance: { cls: 'bg-danger-bg text-danger-ink ring-danger-line', dot: 'bg-danger', label: 'Maintenance' },
  vacant: { cls: 'bg-lilac-2 text-faint ring-line', dot: 'bg-line-strong', label: 'Vacant' },
};

const fmtCount = (n?: number) => (n || 0).toLocaleString('en-IN');

/** Dot + label + value row used in the analytics legend. */
function LegendRow({ dot, label, value }: { dot: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-[13.5px] font-bold text-ink font-mono-numbers">{value}</span>
    </div>
  );
}

/** Small violet "Copy URL" pill for a resident's portal link. */
function CopyLinkButton({
  onClick,
  className = '',
  disabled = false,
}: {
  onClick: () => void;
  className?: string;
  /** No stored pass token → there is no link to copy (never build /t/undefined). */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'This resident has no pass link yet' : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-100 px-3.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-200/70 press disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{disabled ? 'No link' : 'Copy URL'}</span>
    </button>
  );
}

/**
 * Phone bottom navigation for the admin console — same look as the shared
 * `BottomTabBar` (glass bar, rounded top, labelled icons, violet underline,
 * centre gradient FAB with a white halo) but driven by the console's tab
 * state instead of routes. The FAB selects the dashboard (telemetry) tab.
 */
function AdminBottomNav({
  tabs,
  activeTab,
  onSelect,
}: {
  tabs: AdminTabDef[];
  activeTab: AdminTab;
  onSelect: (id: AdminTab) => void;
}) {
  const center = tabs.find((t) => t.id === 'telemetry');
  const rest = tabs.filter((t) => t.id !== 'telemetry');
  const leftCount = center ? Math.ceil(rest.length / 2) : rest.length;
  const left = rest.slice(0, leftCount);
  const right = rest.slice(leftCount);

  const renderTab = (t: AdminTabDef) => {
    const active = t.id === activeTab;
    const Icon = t.icon;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onSelect(t.id)}
        aria-current={active ? 'page' : undefined}
        aria-label={t.count !== undefined ? `${t.short} (${t.count})` : t.short}
        className="flex min-h-[52px] flex-1 justify-center press"
      >
        {/* min-w-0 (not a fixed 56px floor): with 4 side tabs + the centre FAB a
            fixed floor could exceed a 320px viewport. The flex-1 button already
            provides the tap area, so the label just truncates instead. */}
        <span className="relative flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 pt-1 pb-2">
          <span className={`relative ${active ? 'text-brand' : 'text-muted'}`}>
            <Icon
              className="h-6 w-6"
              strokeWidth={active ? 2.3 : 2}
              fill={active ? 'currentColor' : 'none'}
              fillOpacity={active ? 0.16 : 0}
            />
            {t.count !== undefined && (
              <span
                aria-hidden="true"
                className={`absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white font-mono-numbers ${
                  t.countTone === 'danger' ? 'bg-danger' : 'bg-[image:var(--grad-brand)]'
                }`}
              >
                {t.count}
              </span>
            )}
          </span>
          <span className={`max-w-full truncate text-[11px] leading-none ${active ? 'font-bold text-brand-700' : 'font-semibold text-muted'}`}>
            {t.short}
          </span>
          <span
            aria-hidden="true"
            className={`absolute -bottom-0.5 h-[3px] rounded-full bg-[image:var(--grad-brand)] transition-all duration-300 ${
              active ? 'w-9 opacity-100' : 'w-0 opacity-0'
            }`}
          />
        </span>
      </button>
    );
  };

  const centerActive = activeTab === 'telemetry';

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40" aria-label="Admin sections">
      <div
        className="relative flex items-end rounded-t-[26px] border-t border-[#EEE8FD] bg-white px-1.5 pt-2 shadow-[0_-10px_30px_-14px_rgba(70,40,160,0.30)]"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {center ? (
          <>
            <div className="flex flex-1 items-end justify-around">{left.map(renderTab)}</div>
            <div className="flex flex-col items-center px-1.5 pb-2">
              <button
                type="button"
                onClick={() => onSelect('telemetry')}
                aria-label={center.short}
                aria-current={centerActive ? 'page' : undefined}
                className="relative grid h-12 w-12 place-items-center rounded-full bg-[image:var(--grad-brand)] text-white shadow-[0_10px_20px_-8px_rgba(106,43,234,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] ring-4 ring-brand-50 press"
              >
                <span aria-hidden="true" className="absolute inset-x-2.5 top-1 h-1/3 rounded-full bg-white/25 blur-[2px]" />
                <LayoutGrid className="relative h-6 w-6" strokeWidth={2.6} />
              </button>
              <span
                aria-hidden="true"
                className={`mt-1.5 text-[11px] leading-none ${centerActive ? 'font-bold text-brand-700' : 'font-semibold text-muted'}`}
              >
                {center.short}
              </span>
            </div>
            <div className="flex flex-1 items-end justify-around">{right.map(renderTab)}</div>
          </>
        ) : (
          <div className="flex flex-1 items-end justify-around">{rest.map(renderTab)}</div>
        )}
      </div>
    </nav>
  );
}

export default function SuperAdminPortalPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  // Verified super-admin status from the Firebase custom claim `{ admin: true }`.
  // A signed-in Firebase user is NOT an admin until this is confirmed, so we
  // never render the console (and never fire the admin APIs that would 403) for
  // a non-admin account.
  const [isAdmin, setIsAdmin] = useState(false);

  // Sign In states only (no public registration for security)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Platform Telemetry Data
  const [loadingStats, setLoadingStats] = useState(false);
  // True while handleAuthSubmit is signing in. Firebase fires onAuthStateChanged
  // DURING signInWithEmailAndPassword — before POST /api/auth/session has set the
  // session cookie — so the listener must not load admin data then (it 401s).
  // The form handler loads it once the session exists (R-A1).
  const formSignInRef = useRef(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPgId, setSelectedPgId] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<AdminTab>('telemetry');
  const [askConfirm, confirmDialogEl] = useConfirm();
  // Current admin's own tier + permissions (gates which tabs show).
  const [me, setMe] = useState<{ adminRole?: 'super' | 'staff'; permissions: string[] } | null>(null);
  const [upgradeRequests, setUpgradeRequests] = useState<SubscriptionRequest[]>([]);
  const [loadingUpgrades, setLoadingUpgrades] = useState(false);

  // System & Error Logs State
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<SystemLog | null>(null);

  // Account sheet (avatar menu) — UI only.
  const [profileOpen, setProfileOpen] = useState(false);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  const loadLogs = async (level = logFilter) => {
    setLoadingLogs(true);
    try {
      const data = await apiGet<{ logs?: typeof systemLogs }>(`/api/admin/logs?level=${level}&limit=100`);
      setSystemLogs(data.logs || []);
    } catch (e) {
      console.error('Error fetching logs:', e);
      toast.error('Failed to load system error logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadUpgrades = async () => {
    setLoadingUpgrades(true);
    try {
      const data = await apiGet<{ requests?: typeof upgradeRequests }>('/api/admin/subscriptions');
      setUpgradeRequests(data.requests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUpgrades(false);
    }
  };

  const handleApproveUpgrade = async (requestId: string) => {
    try {
      await apiPost('/api/admin/subscriptions', { requestId, action: 'approve' });
      toast.success('Subscription plan upgraded successfully');
      await loadUpgrades();
      await loadPlatformData();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not approve upgrade'));
    }
  };

  const handleToggleAccountStatus = async (ownerId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const ok = await askConfirm({
      title: newStatus === 'suspended' ? 'Suspend this account?' : 'Reactivate this account?',
      message:
        newStatus === 'suspended'
          ? 'The owner and their staff will be signed out and blocked until reactivated.'
          : 'The owner will be able to sign in and use PGPass again.',
      confirmLabel: newStatus === 'suspended' ? 'Suspend' : 'Reactivate',
      tone: newStatus === 'suspended' ? 'danger' : 'default',
    });
    if (!ok) return;

    try {
      await apiPatch('/api/admin/accounts', { ownerId, accountStatus: newStatus });
      toast.success(`Account status set to ${newStatus}`);
      await loadPlatformData();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Failed to update account status'));
    }
  };

  // Load the signed-in admin's own tier + permissions (ungated endpoint) so the
  // console knows which tabs to show. A staff admin without `platform.view`
  // still gets a usable console scoped to what they CAN do.
  const loadMe = useCallback(async () => {
    try {
      const data = await apiGet<{ adminRole?: 'super' | 'staff'; permissions?: string[] }>('/api/admin/me');
      const meData = { adminRole: data.adminRole, permissions: data.permissions || [] };
      setMe(meData);
      // Land on a tab the admin can actually see.
      const can = (p: string) => meData.adminRole === 'super' || meData.permissions.includes(p);
      if (can('platform.view')) setActiveTab('telemetry');
      else if (can('subscriptions.manage')) setActiveTab('upgrades');
      else if (can('support.manage')) setActiveTab('support');
      else if (can('logs.view')) setActiveTab('logs');
      else if (meData.adminRole === 'super') setActiveTab('admins');
    } catch {
      /* non-fatal; tabs just fall back to defaults */
    }
  }, []);

  // Declared BEFORE the auth effect + handlers that call it (the compiler flags
  // use-before-declare on a const arrow). useCallback keeps it stable so the
  // mount-once auth subscription doesn't need to re-run when it changes.
  const loadPlatformData = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await apiGet<PlatformStats>('/api/admin/overview');
      setStats(data);
      if (data.allPgs.length > 0 && !selectedPgId) {
        setSelectedPgId(data.allPgs[0].owner.id);
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Failed to load platform telemetry'));
    } finally {
      setLoadingStats(false);
    }
  }, [selectedPgId]);

  // Listen to Firebase Auth state and verify the admin custom claim before
  // treating the session as an admin session.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Captured synchronously: Firebase invokes this listener from inside
      // signInWithEmailAndPassword, so a form sign-in is still flagged here even
      // if handleAuthSubmit finishes before the awaits below (no double load).
      const formInFlight = formSignInRef.current;
      setCurrentUser(user);
      if (user) {
        // Force-refresh so a claim granted after the user last signed in (via
        // the bootstrap script / claims route) is picked up without re-login.
        let admin = false;
        try {
          const token = await getIdTokenResult(user, true);
          admin = token.claims.admin === true;
        } catch {
          admin = false;
        }
        setIsAdmin(admin);
        if (admin && formInFlight) {
          // Form sign-in in progress: show the loading state (not the error
          // banner) until handleAuthSubmit has the session cookie and loads —
          // unless the handler already finished (then it has loaded).
          if (formSignInRef.current) setLoadingStats(true);
        } else if (admin) {
          await loadMe();
          await loadPlatformData();
        } else {
          setStats(null);
        }
      } else {
        setIsAdmin(false);
        setStats(null);
      }
      setIsInitializing(false);
    });

    return () => unsubscribe();
    // Mount-once auth subscription. `loadPlatformData` is stable (useCallback)
    // and declared above; it's intentionally not a dep so we don't re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the next page of PGs (cursor pagination) and append to the directory.
  const loadMorePgs = async () => {
    if (!stats?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiGet<PlatformStats>(`/api/admin/overview?cursor=${encodeURIComponent(stats.nextCursor)}`);
      setStats((prev) =>
        prev
          ? { ...data, allPgs: [...prev.allPgs, ...data.allPgs] }
          : data
      );
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not load more PGs'));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    formSignInRef.current = true;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);

      // Verify the super-admin custom claim BEFORE establishing a session. A
      // valid Firebase login is not enough — only accounts bootstrapped with
      // `{ admin: true }` may enter the console. This is what stops ordinary
      // owner credentials from reaching the admin panel.
      const token = await getIdTokenResult(userCredential.user, true);
      if (token.claims.admin !== true) {
        await signOut(auth).catch(() => {});
        setIsAdmin(false);
        throw new Error(
          'This account is not an authorized administrator. Admin access is restricted to provisioned admin accounts.'
        );
      }

      const idToken = token.token;
      // `mode: 'login'` is required: the session route treats a missing mode as
      // a background refresh, which (correctly) refuses to mint a session when
      // the browser has no session id yet — so admin sign-in always failed.
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, mode: 'login' }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Could not start a secure admin session. Please try again.'));
      }
      setIsAdmin(true);
      toast.success('Admin authenticated successfully');
      // The session cookie now exists — load the console exactly once here
      // (the auth listener skipped it while the sign-in was in flight).
      formSignInRef.current = false;
      await loadMe();
      await loadPlatformData();
    } catch (err: unknown) {
      console.error(err);
      const code =
        err && typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code
          : '';
      let msg = 'Authentication failed. Please check your admin credentials.';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        msg = 'Invalid email or password. Access denied.';
      } else if (code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-in is not enabled in Firebase Console. Please enable it in Authentication -> Sign-in method.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please wait a few minutes.';
      } else if (err instanceof Error && err.message) {
        msg = err.message;
      }
      setAuthError(msg);
      toast.error(msg);
      setLoadingStats(false);
    } finally {
      formSignInRef.current = false;
      setSubmitting(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      await signOut(auth);
      clearLocalData();
      setCurrentUser(null);
      setIsAdmin(false);
      setStats(null);
      setEmail('');
      setPassword('');
      toast.success('Admin session ended');
    } catch {
      toast.error('Error signing out');
    }
  };

  const handleCopyLink = (token?: string) => {
    if (!token) return;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    void copyText(`${baseUrl}/t/${token}`).then((ok) =>
      ok ? toast.success('Resident link copied') : toast.error('Could not copy — long-press or select the text to copy it manually')
    );
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '••••';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 4) return '••••';
    return `•••${clean.slice(-4)}`;
  };

  if (isInitializing) {
    return (
      <div className="theme-admin flex min-h-screen flex-col items-center justify-center gap-5 p-4" role="status">
        <Logo size={42} />
        <div className="app-card flex items-center gap-2.5 rounded-full px-4 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-ink-2">Checking admin credentials...</span>
        </div>
      </div>
    );
  }

  // ---------------- AUTHENTICATION GATE (STRICT ADMIN-CLAIM ONLY) ----------------
  // Show the admin login form for signed-out visitors AND for signed-in users
  // who are not verified admins (e.g. an owner who typed /admin). The latter get
  // an explicit "not authorized" banner instead of a broken, 403-ing console.
  if (!currentUser || !isAdmin) {
    const signedInButNotAdmin = !!currentUser && !isAdmin;
    return (
      <div
        className="theme-admin flex min-h-[100dvh] flex-col items-center justify-center px-4 text-ink sm:pb-10"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="w-full max-w-md animate-pop">
          <div className="mb-3 flex justify-center sm:mb-5">
            <Logo size={38} />
          </div>

          <div className="app-card relative overflow-hidden p-5 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-brand-200/50 blur-3xl" />
            <div className="relative">
              {/* Phones: a smaller scene so the whole form fits one screen. */}
              <Illustration name="hero-admin" width={280} priority float className="mx-auto block w-[118px] sm:w-[280px]" />

              <div className="mt-2 text-center">
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[image:var(--grad-brand)] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[var(--shadow-brand)]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Admin Panel
                </span>
                <h1 className="mt-1 sm:mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.025em] text-ink sm:text-[26px]">
                  PGPass <span className="text-gradient">Super Admin</span>
                </h1>
                <p className="mt-1.5 hidden sm:block text-sm font-medium leading-relaxed text-muted">
                  Sign in with your authorized admin email and password.
                </p>
              </div>

              {signedInButNotAdmin && (
                <InfoBanner
                  tone="danger"
                  title="Not an admin account"
                  description="You are signed in, but this account is not an authorized administrator. The admin console is restricted to provisioned admin accounts."
                  className="mt-4 sm:mt-5 text-left"
                >
                  <div className="grid grid-cols-2 divide-x divide-white/70">
                    <Link
                      href="/dashboard"
                      className="flex min-h-11 items-center justify-center px-3 text-center text-[13px] font-bold text-brand-700 transition-colors hover:bg-white/50"
                    >
                      Go to Owner Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="flex min-h-11 items-center justify-center px-3 text-[13px] font-bold text-ink-2 transition-colors hover:bg-white/50"
                    >
                      Sign out
                    </button>
                  </div>
                </InfoBanner>
              )}

              <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
                <Input
                  label="Admin Email Address"
                  type="email"
                  placeholder="admin@yourdomain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={submitting}
                  leading={<Mail />}
                />

                <Input
                  label="Admin Password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  leading={<Lock />}
                />

                {authError && (
                  <InfoBanner tone="danger" title="Sign-in failed" description={authError} className="animate-shake" />
                )}

                <Button type="submit" size="full" variant="solid" loading={submitting}>
                  Sign In to Admin Console
                </Button>
              </form>

              <div className="mt-4 sm:mt-6 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs">
                <span className="font-semibold text-muted">Authorized personnel only</span>
                <Link href="/" className="inline-flex min-h-11 items-center font-bold text-brand-700 hover:underline">
                  Return Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- AUTHENTICATED ADMIN DASHBOARD ----------------
  const allPgs = stats?.allPgs || [];
  const filteredPgs = allPgs.filter((pg) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    // Null-safe: an owner doc can predate onboarding (no pgName/name/phone).
    return [pg.owner.pgName, pg.owner.name, pg.owner.phone, pg.owner.email, pg.setupPending ? 'setup pending' : '']
      .some((v) => typeof v === 'string' && v.toLowerCase().includes(q));
  });
  const pgTitle = (pg: { owner: { pgName?: string }; setupPending?: boolean }) =>
    pg.owner.pgName?.trim() || 'Setup pending';

  const selectedPg = allPgs.find((p) => p.owner.id === selectedPgId) || allPgs[0];

  const residentColumns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Resident',
      sortable: true,
      render: (t) => <span className="font-bold text-ink">{t.name}</span>,
    },
    {
      key: 'phone',
      header: 'Masked Phone',
      render: (t) => <span className="text-muted font-mono-numbers">+91 {maskPhone(t.phone)}</span>,
    },
    {
      key: 'bedLabel',
      header: 'Unit',
      sortable: true,
      render: (t) => <Badge variant="brand">{t.bedLabel || 'Bed'}</Badge>,
    },
    {
      key: 'monthlyRent',
      header: 'Monthly Rent',
      sortable: true,
      align: 'right',
      render: (t) => <span className="font-bold text-ink font-mono-numbers">{formatCurrency(t.monthlyRent || 0)}</span>,
    },
    {
      key: 'token',
      header: 'Portal Link',
      align: 'center',
      render: (t) => <CopyLinkButton onClick={() => handleCopyLink(t.token)} disabled={!t.token} className="h-9" />,
    },
  ];

  // A super admin sees everything; a staff admin sees only what they're granted.
  const can = (perm: string) => me?.adminRole === 'super' || !!me?.permissions.includes(perm);

  // Switching tabs: upgrades + logs refresh their data on open (unchanged behaviour).
  const selectTab = (id: AdminTab) => {
    setActiveTab(id);
    if (id === 'upgrades') loadUpgrades();
    else if (id === 'logs') loadLogs();
  };

  // Navigation-driven tab switches (bottom nav, pill tabs, bell, quick actions)
  // also bring the new section into view from the top.
  const goToTab = (id: AdminTab) => {
    selectTab(id);
    window.scrollTo({ top: 0 });
  };

  const errorLogCount = systemLogs.filter((l) => l.level === 'error').length;

  // Tabs are gated by the signed-in admin's permissions (super sees all).
  const tabDefs: AdminTabDef[] = [];
  if (can('platform.view')) tabDefs.push({ id: 'telemetry', label: 'Dashboard', short: 'Dashboard', icon: LayoutGrid });
  if (can('subscriptions.manage'))
    tabDefs.push({
      id: 'upgrades',
      label: 'Upgrade Requests',
      short: 'Upgrades',
      icon: CreditCard,
      count: upgradeRequests.length > 0 ? upgradeRequests.length : undefined,
      countTone: 'brand',
    });
  if (can('logs.view'))
    tabDefs.push({
      id: 'logs',
      label: 'System Logs',
      short: 'Logs',
      icon: Bug,
      count: errorLogCount > 0 ? errorLogCount : undefined,
      countTone: 'danger',
    });
  if (can('support.manage')) tabDefs.push({ id: 'support', label: 'Owner Support', short: 'Support', icon: MessageSquare });
  if (me?.adminRole === 'super') tabDefs.push({ id: 'admins', label: 'Admins', short: 'Admins', icon: ShieldCheck });

  const onTabBarChange = (id: string) => {
    const t = tabDefs.find((x) => x.id === id);
    if (t) goToTab(t.id);
  };

  // Header bell → the owner support inbox (or the error logs for admins without support access).
  const bellTarget: AdminTab | null = can('support.manage') ? 'support' : can('logs.view') ? 'logs' : null;
  const bellCount = bellTarget === 'logs' ? errorLogCount : 0;

  // Identity (Firebase user) for the greeting + avatar.
  const adminName = currentUser.displayName?.trim() || '';
  const firstName = adminName.split(/\s+/)[0] || 'Admin';
  const avatarName = adminName || currentUser.email || 'Admin';
  const roleLabel = me?.adminRole === 'super' ? 'Super admin' : me?.adminRole === 'staff' ? 'Staff admin' : 'Admin';
  const adminDisplayName = adminName || roleLabel;

  // Platform analytics — derived only from the overview already loaded.
  const totalBeds = stats?.platformTotalBeds || 0;
  const totalResidents = stats?.platformTotalResidents || 0;
  const occupancyPct = totalBeds > 0 ? Math.round((totalResidents / totalBeds) * 100) : 0;
  const loadedCollected = allPgs.reduce((acc, p) => acc + (p.totalCollected || 0), 0);
  const loadedPending = allPgs.reduce((acc, p) => acc + (p.totalPending || 0), 0);

  const scrollToDirectory = () => {
    selectTab('telemetry');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('pg-directory')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const quickActions: QuickAction[] = [];
  if (can('platform.view')) quickActions.push({ label: 'Manage PGs', icon: 'building', tint: 'violet', onClick: scrollToDirectory });
  if (me?.adminRole === 'super') quickActions.push({ label: 'Manage Admins', icon: 'users', tint: 'sky', onClick: () => goToTab('admins') });
  if (can('subscriptions.manage')) quickActions.push({ label: 'Upgrade Requests', icon: 'rupee', tint: 'mint', onClick: () => goToTab('upgrades') });
  if (can('support.manage')) quickActions.push({ label: 'Owner Support', icon: 'bell', tint: 'peach', onClick: () => goToTab('support') });
  if (can('logs.view')) quickActions.push({ label: 'View Logs', icon: 'report', tint: 'indigo', onClick: () => goToTab('logs') });
  const qaCount = quickActions.length;
  const qaColumns: 2 | 3 | 4 | 5 = qaCount >= 5 ? 5 : qaCount === 4 ? 4 : qaCount === 3 ? 3 : 2;

  const bedCounts = selectedPg
    ? selectedPg.beds.reduce<Record<string, number>>((acc, b) => {
        const k = b.status in BED_STATUS_STYLE ? b.status : 'occupied';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {})
    : {};

  // Tenant docs don't store rent — it lives on the tenant's bed. Attach it so
  // the resident list shows it and the "Monthly Rent" column can sort.
  const bedRentById = new Map((selectedPg?.beds ?? []).map((b) => [b.id, b.monthlyRent || 0]));
  const tenantsWithRent = (selectedPg?.tenants ?? []).map((t) => ({
    ...t,
    monthlyRent: t.monthlyRent ?? bedRentById.get(t.bedId) ?? 0,
  }));
  // Owners rarely have a single default rent (rent is set per sharing type on
  // beds), so fall back to the PG's bed rent range.
  const bedRents = (selectedPg?.beds ?? []).map((b) => b.monthlyRent || 0).filter((r) => r > 0);
  const rentMin = bedRents.length ? Math.min(...bedRents) : 0;
  const rentMax = bedRents.length ? Math.max(...bedRents) : 0;
  const ownerDefaultRent = selectedPg?.owner.monthlyRent || 0;
  const rentLabel = ownerDefaultRent ? 'Default rent' : 'Bed rent';
  const rentValue = ownerDefaultRent
    ? formatCurrency(ownerDefaultRent)
    : rentMin === rentMax
      ? formatCurrency(rentMin)
      : `${formatCurrency(rentMin)} – ${formatCurrency(rentMax)}`;

  return (
    <div className="theme-admin min-h-screen text-ink">
      <IdleLogout role="admin" redirectTo="/admin" />

      {/* Sticky glass top bar: logo · bell · avatar (+ pill tabs on md+) */}
      <header
        className="sticky top-0 z-30 rounded-b-[26px] border-b border-[#EEE8FD] bg-white shadow-[0_10px_30px_-14px_rgba(70,40,160,0.30)] md:rounded-none"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <span className="flex min-w-0 items-center">
            <Logo size={36} />
          </span>

          <div className="flex shrink-0 items-center gap-2.5">
            {bellTarget && (
              <button
                type="button"
                onClick={() => goToTab(bellTarget)}
                aria-label={
                  bellTarget === 'support'
                    ? 'Owner support messages'
                    : bellCount > 0
                    ? `System error logs (${bellCount} errors)`
                    : 'System error logs'
                }
                className="relative grid h-11 w-11 place-items-center rounded-full border border-white bg-white/90 text-ink shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)] press"
              >
                <Bell className="h-5 w-5" strokeWidth={2.1} />
                {bellCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10.5px] font-bold text-white ring-2 ring-white font-mono-numbers"
                  >
                    {bellCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label="Open admin account menu"
              aria-haspopup="dialog"
              aria-expanded={profileOpen}
              className="flex min-h-11 items-center gap-2 rounded-full press"
            >
              <Avatar name={avatarName} size="md" />
              <span className="hidden min-w-0 text-left lg:block">
                <span className="block max-w-[200px] truncate text-[13px] font-bold text-ink">{adminDisplayName}</span>
                <span className="block max-w-[200px] truncate text-[11.5px] font-medium text-muted">{currentUser.email}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-ink-2" aria-hidden="true" />
            </button>
          </div>
        </div>

        {tabDefs.length > 0 && (
          <div className="hidden md:block">
            <div className="mx-auto w-full max-w-6xl px-6 pb-3 lg:px-8">
              <TabBar
                tabs={tabDefs.map(({ id, label, count }) => ({ id, label, count }))}
                activeTab={activeTab}
                onChange={onTabBarChange}
                className="w-fit"
              />
            </div>
          </div>
        )}
      </header>

      {/* Main content — bottom padding on phones clears the fixed bottom nav + FAB. */}
      <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 md:pt-6 md:pb-14 lg:px-8">
        <div key={activeTab} className="animate-fade-up space-y-5">
          {activeTab === 'admins' ? (
            <>
              <PageHeader
                icon="staff"
                tint="indigo"
                title="Admins"
                subtitle="Add staff admins and control exactly what each one can access."
              />
              <AdminUsersPanel />
            </>
          ) : activeTab === 'support' ? (
            <>
              <PageHeader
                icon="bell-purple"
                tint="violet"
                title="Owner"
                highlight="Support"
                subtitle="Live conversations with PG owners — one thread per owner."
              />
              <AdminSupportPanel />
            </>
          ) : activeTab === 'upgrades' ? (
            <>
              <PageHeader
                icon="rupee"
                tint="mint"
                title="Pending SaaS"
                highlight="Upgrades"
                subtitle="Verify direct UPI UTR settlements and activate owner Growth / Pro quotas."
                actions={
                  <Button size="md" variant="outline" onClick={loadUpgrades} loading={loadingUpgrades}>
                    Refresh
                  </Button>
                }
              />

              {loadingUpgrades && upgradeRequests.length === 0 ? (
                <ListSkeleton rows={3} />
              ) : upgradeRequests.length === 0 ? (
                <div className="app-card">
                  <EmptyState
                    icon3d="check"
                    title="No pending upgrade requests"
                    description="All accounts are on authorized tiers."
                  />
                </div>
              ) : (
                <div className="space-y-3 stagger">
                  {upgradeRequests.map((req) => (
                    <div key={req.id} className="app-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <IconBubble icon="rupee-badge" tint="mint" size={48} />
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[15px] font-bold text-ink">
                              Owner ID: <span className="font-mono text-[13px]">{req.ownerId?.slice(0, 8)}...</span>
                            </span>
                            <Badge variant="brand" className="capitalize">
                              {req.requestedPlan} ({req.billingCycle})
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-lg font-extrabold leading-none text-success-ink font-mono-numbers">
                              {formatCurrency((req.amountPaise || 0) / 100)}
                            </span>
                            <span className="text-[13px] font-medium text-muted">
                              Submitted UTR:{' '}
                              <strong className="font-mono font-bold text-ink">{req.utrReference}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pl-[62px] sm:pl-0">
                        {req.status === 'approved' ? (
                          <Badge variant="paid" dot>
                            Approved
                          </Badge>
                        ) : (
                          <Button size="md" variant="success" onClick={() => handleApproveUpgrade(req.id)}>
                            <CheckCircle2 className="h-4 w-4" />
                            Approve & Activate Quotas
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : activeTab === 'logs' ? (
            <>
              <PageHeader
                icon="alert"
                tint="rose"
                title="System"
                highlight="Error Logs"
                subtitle="Real-time technical errors, Firebase auth exceptions, and server diagnostics."
                actions={
                  <>
                    <Dropdown
                      aria-label="Filter logs by level"
                      value={logFilter}
                      onChange={(v) => {
                        setLogFilter(v);
                        loadLogs(v);
                      }}
                      containerClassName="w-44"
                      options={[
                        { value: 'all', label: 'All Levels' },
                        { value: 'error', label: 'Errors Only' },
                        { value: 'warn', label: 'Warnings Only' },
                        { value: 'info', label: 'Info Only' },
                      ]}
                    />
                    <Button size="md" variant="outline" onClick={() => loadLogs(logFilter)} loading={loadingLogs}>
                      <RefreshCw className="h-4 w-4" />
                      <span>Refresh</span>
                    </Button>
                  </>
                }
              />

              {loadingLogs && systemLogs.length === 0 ? (
                <ListSkeleton rows={5} />
              ) : systemLogs.length === 0 ? (
                <div className="app-card">
                  <EmptyState
                    icon3d="check"
                    title="No System Errors Detected"
                    description="All cloud services, authentications, and APIs are operating normally."
                  />
                </div>
              ) : (
                <div className="app-card divide-y divide-line px-3 sm:px-5">
                  {systemLogs.map((log) => {
                    const isError = log.level === 'error';
                    const isWarn = log.level === 'warn';
                    return (
                      <div key={log.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <IconBubble
                            icon={isError || isWarn ? 'alert' : 'doc'}
                            tint={isError ? 'rose' : isWarn ? 'peach' : 'sky'}
                            size={42}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <Badge variant={isError ? 'danger' : isWarn ? 'pending' : 'cyan'} dot className="capitalize">
                                {log.level}
                              </Badge>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
                                {log.source === 'client' ? (
                                  <>
                                    <Globe className="h-3.5 w-3.5 text-info" aria-hidden="true" /> Client
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3.5 w-3.5 text-warning" aria-hidden="true" /> Server
                                  </>
                                )}
                              </span>
                              <span className="text-xs font-medium text-muted font-mono-numbers">
                                {new Date(log.createdAt ?? 0).toLocaleString('en-IN', {
                                  dateStyle: 'short',
                                  timeStyle: 'medium',
                                })}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 wrap-break-word text-[13.5px] font-semibold text-ink" title={log.message}>
                              {log.message}
                            </p>
                            <p className="mt-0.5 truncate text-[11.5px] text-muted">
                              <span className="font-mono font-bold text-ink-2">{log.code || 'UNKNOWN'}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono">{log.route || '-'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 pl-[54px] sm:pl-0">
                          <Button size="md" variant="soft" onClick={() => setSelectedLogForDetails(log)}>
                            Inspect
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Greeting hero (ref: admin-panel.png) */}
              <HeroHeader
                variant="light"
                eyebrow={
                  <>
                    <ShieldCheck aria-hidden="true" />
                    Admin Panel
                  </>
                }
                title="Welcome back,"
                highlight={`${firstName}!`}
                subtitle="Manage everything in one place."
                illustration="hero-admin"
                meta={
                  <span className="chip">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {roleLabel}
                  </span>
                }
              />

              {/* Platform stat tiles */}
              {loadingStats && !stats ? (
                <StatGridSkeleton count={4} />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 stagger">
                  <StatTile icon="house" tint="violet" label="Total PGs" value={fmtCount(stats?.platformTotalPgs)} />
                  <StatTile icon="users" tint="sky" label="Active Residents" value={fmtCount(stats?.platformTotalResidents)} />
                  <StatTile icon="bed" tint="mint" label="Total Beds" value={fmtCount(stats?.platformTotalBeds)} />
                  <StatTile
                    icon="wallet-orange"
                    tint="peach"
                    label="Volume (loaded)"
                    value={formatCurrency(stats?.platformTotalVolume || 0)}
                  />
                </div>
              )}

              {!stats && !loadingStats && (
                <InfoBanner
                  tone="danger"
                  title="Couldn't load platform telemetry"
                  description="Platform totals and the PG directory are unavailable right now. Check your connection and try again."
                  action={
                    <Button size="sm" variant="outline" onClick={() => loadPlatformData()}>
                      Retry
                    </Button>
                  }
                />
              )}

              {/* Analytics + quick actions */}
              <div
                className={`grid items-start gap-5 ${
                  quickActions.length > 0 ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : ''
                }`}
              >
                <SectionCard title="Platform Analytics" icon="chart" action={<span className="chip shrink-0">This month</span>}>
                  <div className="flex flex-col items-center gap-5 sm:flex-row">
                    <div className="shrink-0">
                      <DonutChart
                        percent={occupancyPct}
                        label={totalBeds > 0 ? undefined : '—'}
                        sublabel="Occupancy"
                        size={136}
                        stroke={16}
                      />
                    </div>
                    <div className="w-full min-w-0 flex-1">
                      <div className="divide-y divide-line">
                        <LegendRow dot="bg-brand" label="Active residents" value={fmtCount(totalResidents)} />
                        <LegendRow dot="bg-brand-200" label="Total beds" value={fmtCount(totalBeds)} />
                      </div>
                      <div className="well mt-3 divide-y divide-line px-3.5 py-0.5">
                        <LegendRow dot="bg-success" label="Rent collected" value={formatCurrency(loadedCollected)} />
                        <LegendRow dot="bg-warning" label="Rent pending" value={formatCurrency(loadedPending)} />
                      </div>
                      <p className="mt-2 text-[11.5px] font-medium text-muted">
                        Rent figures cover the {allPgs.length} PG{allPgs.length === 1 ? '' : 's'} loaded below.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                {quickActions.length > 0 && <QuickActionGrid actions={quickActions} columns={qaColumns} />}
              </div>

              {/* PG directory (master list) + selected PG detail */}
              <section id="pg-directory" className="scroll-mt-24 md:scroll-mt-40" aria-label="PG directory">
                <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                  <aside className="app-card flex max-h-[26rem] flex-col p-3 sm:p-4 lg:sticky lg:top-36 lg:max-h-[calc(100dvh-10rem)]">
                    <SectionHeader
                      title="PG Directory"
                      icon="building"
                      action={
                        <span className="chip shrink-0 font-mono-numbers">
                          {allPgs.length}
                          {stats?.nextCursor ? '+' : ''}
                        </span>
                      }
                      className="px-1"
                    />
                    <SearchInput
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search PG or owner..."
                      aria-label="Search PG or owner"
                    />

                    <div className="-mx-1 mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-1 pb-1">
                      {filteredPgs.length === 0 ? (
                        <EmptyState
                          icon3d="building"
                          title={searchQuery.trim() ? 'No matching PGs' : 'No PGs registered yet.'}
                          description={searchQuery.trim() ? 'Try a different PG name, owner or phone.' : undefined}
                          className="py-6"
                        />
                      ) : (
                        filteredPgs.map((pg) => {
                          const isSelected = selectedPg?.owner.id === pg.owner.id;
                          return (
                            <button
                              key={pg.owner.id}
                              type="button"
                              onClick={() => setSelectedPgId(pg.owner.id)}
                              aria-pressed={isSelected}
                              className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors press ${
                                isSelected ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-lilac'
                              }`}
                            >
                              <IconBubble icon="building" tint={isSelected ? 'violet' : 'slate'} size={42} />
                              <div className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className={`truncate text-[14px] font-bold ${pg.setupPending ? 'text-muted' : 'text-ink'}`}>
                                    {pgTitle(pg)}
                                  </span>
                                </span>
                                <span className="block truncate text-xs font-medium text-muted">
                                  {[pg.owner.name, pg.owner.phone || pg.owner.email].filter(Boolean).join(' · ') ||
                                    'Owner has not finished onboarding'}
                                </span>
                                <span className="mt-1 flex items-center gap-1.5 text-[11.5px] font-semibold font-mono-numbers">
                                  <span className="text-ink-2">{pg.beds.length} beds</span>
                                  <span className="text-faint" aria-hidden="true">
                                    •
                                  </span>
                                  <span className="text-success-ink">{pg.tenants.length} occupied</span>
                                </span>
                              </div>
                              {pg.owner.accountStatus === 'suspended' && <Badge variant="danger">Suspended</Badge>}
                            </button>
                          );
                        })
                      )}

                      {/* Cursor pagination — only when not filtering a search locally. */}
                      {stats?.nextCursor && !searchQuery.trim() && (
                        <div className="pt-2">
                          <Button variant="soft" size="full" onClick={loadMorePgs} disabled={loadingMore}>
                            {loadingMore ? 'Loading…' : 'Load more PGs'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </aside>

                  {/* Detail panel: selected PG */}
                  <div className="min-w-0 space-y-4">
                    {selectedPg ? (
                      <>
                        {/* Selected PG header */}
                        <section className="app-card p-4 sm:p-5">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex min-w-0 items-start gap-3.5">
                              <IconTile icon="building" tint="violet" size={56} />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-lg font-extrabold tracking-[-0.02em] text-ink sm:text-xl">
                                    {pgTitle(selectedPg)}
                                  </h2>
                                  {selectedPg.setupPending && <Badge variant="pending">Setup pending</Badge>}
                                  <Badge variant="neutral" className="font-mono">
                                    ID: {selectedPg.owner.id.slice(0, 8)}
                                  </Badge>
                                  <Badge variant={selectedPg.owner.accountStatus === 'suspended' ? 'danger' : 'paid'} dot>
                                    {selectedPg.owner.accountStatus === 'suspended' ? 'Suspended' : 'Active'}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-2">
                                  Owner: {selectedPg.owner.name || '—'} · Phone:{' '}
                                  <span className="font-mono-numbers">{selectedPg.owner.phone || '—'}</span> · UPI:{' '}
                                  {selectedPg.owner.upiId || 'None'}
                                </p>
                                {selectedPg.owner.pgAddress && (
                                  <p className="mt-0.5 text-xs font-medium text-muted">{selectedPg.owner.pgAddress}</p>
                                )}
                              </div>
                            </div>

                            <Button
                              size="md"
                              variant={selectedPg.owner.accountStatus === 'suspended' ? 'success' : 'destructive'}
                              onClick={() =>
                                handleToggleAccountStatus(selectedPg.owner.id, selectedPg.owner.accountStatus || 'active')
                              }
                              className="shrink-0 self-start"
                            >
                              {selectedPg.owner.accountStatus === 'suspended' ? 'Reactivate PG' : 'Suspend Account'}
                            </Button>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:max-w-md">
                            <div className="well px-3.5 py-2.5">
                              <span className="block text-xs font-semibold text-muted">{rentLabel}</span>
                              <span className="block text-base font-extrabold text-ink font-mono-numbers">
                                {rentValue}
                              </span>
                            </div>
                            <div className="well px-3.5 py-2.5">
                              <span className="block text-xs font-semibold text-muted">Occupied / units</span>
                              <span className="block text-base font-extrabold text-success-ink font-mono-numbers">
                                {selectedPg.tenants.length} / {selectedPg.beds.length}
                              </span>
                            </div>
                          </div>
                        </section>

                        {/* Bed occupancy matrix */}
                        <SectionCard
                          title="Bed occupancy"
                          icon="bed"
                          action={
                            <span className="chip shrink-0 font-mono-numbers">{selectedPg.beds.length} total beds</span>
                          }
                        >
                          {selectedPg.beds.length >= 500 && (
                            <p className="mb-3 text-xs font-semibold text-info-ink">
                              Showing the first 500 beds for this PG (admin detail is windowed).
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {selectedPg.beds.map((bed) => {
                              const isOcc = bed.status !== 'vacant';
                              const s = BED_STATUS_STYLE[bed.status] ?? BED_STATUS_STYLE.occupied;
                              return (
                                <div
                                  key={bed.id}
                                  title={`Bed ${bed.bedLabel}: ${isOcc ? bed.tenantName || 'Occupied' : 'Vacant'}`}
                                  className={`grid h-7 w-7 cursor-default select-none place-items-center rounded-lg text-[10.5px] font-bold ring-1 ring-inset font-mono-numbers ${s.cls}`}
                                >
                                  {bed.bedLabel.slice(-1)}
                                </div>
                              );
                            })}
                          </div>
                          {selectedPg.beds.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                              {Object.entries(BED_STATUS_STYLE)
                                .filter(([k]) => bedCounts[k])
                                .map(([k, s]) => (
                                  <span key={k} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden="true" />
                                    {s.label}
                                    <span className="text-muted font-mono-numbers">{bedCounts[k]}</span>
                                  </span>
                                ))}
                            </div>
                          )}
                        </SectionCard>

                        {/* Per-PG feature access control (admin, server-enforced) */}
                        <AdminPgFeatures ownerId={selectedPg.owner.id} />

                        {/* Admin act-as-owner management + full history */}
                        <AdminPgManage pg={selectedPg} onChanged={loadPlatformData} />

                        {/* Residents */}
                        <div>
                          <SectionHeader
                            title={`Active leaseholders (${selectedPg.tenants.length})`}
                            icon="users"
                            className="px-1"
                          />
                          {/* Phones get their own list: DataTable's stacked rows are disabled
                              <button>s, which would swallow taps on the nested Copy URL button. */}
                          <div className="app-card p-2 sm:hidden">
                            {selectedPg.tenants.length === 0 ? (
                              <EmptyState
                                icon3d="users"
                                title="No residents yet"
                                description="No residents currently registered in this PG."
                                className="py-8"
                              />
                            ) : (
                              <div className="divide-y divide-line">
                                {tenantsWithRent.map((t) => (
                                  <div key={t.id} className="flex items-center gap-3 px-2 py-3">
                                    <Avatar name={t.name} size="md" />
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-[14px] font-bold text-ink">{t.name}</div>
                                      <div className="truncate text-xs font-medium text-muted">
                                        <span className="font-mono-numbers">+91 {maskPhone(t.phone)}</span> · {t.bedLabel || 'Bed'}
                                      </div>
                                      <div className="text-[13px] font-bold text-ink font-mono-numbers">
                                        {formatCurrency(t.monthlyRent || 0)}
                                        <span className="text-xs font-medium text-muted"> /month</span>
                                      </div>
                                    </div>
                                    <CopyLinkButton onClick={() => handleCopyLink(t.token)} disabled={!t.token} className="h-11" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="hidden sm:block">
                            <DataTable
                              columns={residentColumns}
                              data={tenantsWithRent}
                              keyExtractor={(t) => t.id}
                              emptyText="No residents currently registered in this PG."
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="app-card">
                        <EmptyState
                          icon3d="building"
                          title="No PG selected"
                          description="Select a PG from the directory to inspect telemetry."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Phone bottom navigation (tab-driven, same look as BottomTabBar) */}
      {tabDefs.length > 0 && <AdminBottomNav tabs={tabDefs} activeTab={activeTab} onSelect={goToTab} />}

      {/* ADMIN ACCOUNT SHEET (avatar menu) */}
      <Drawer isOpen={profileOpen} onClose={closeProfile} title="Admin account" width="sm">
        <div className="space-y-4">
          <div className="app-card flex items-center gap-3 p-4">
            <Avatar name={avatarName} size="lg" />
            <div className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold text-ink">{adminDisplayName}</span>
              <span className="block truncate text-[13px] font-medium text-muted">{currentUser.email}</span>
            </div>
          </div>
          <div className="tint-card tint-violet flex items-center gap-3 p-4">
            <GlyphTile icon={ShieldCheck} size={40} />
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-ink-2">Access level</span>
              <span className="block text-[15px] font-extrabold text-ink">{roleLabel}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="full"
            onClick={() => {
              setProfileOpen(false);
              handleAdminLogout();
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </Drawer>

      {/* ERROR LOG INSPECT DRAWER */}
      {selectedLogForDetails && (
        <Drawer
          isOpen={!!selectedLogForDetails}
          onClose={() => setSelectedLogForDetails(null)}
          title={`Error Diagnostics: ${selectedLogForDetails.code || selectedLogForDetails.level.toUpperCase()}`}
          description={`Captured at ${new Date(selectedLogForDetails.createdAt ?? 0).toLocaleString('en-IN')}`}
          width="lg"
          footer={
            <Button variant="outline" size="md" onClick={() => setSelectedLogForDetails(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-left">
            <div className="space-y-1.5">
              <span className="block text-[13px] font-semibold text-ink-2">Error message</span>
              <div className="wrap-break-word rounded-2xl border border-danger-line bg-danger-bg px-4 py-3 text-[13.5px] font-medium leading-relaxed text-danger-ink">
                {selectedLogForDetails.message}
              </div>
            </div>

            <div className="well divide-y divide-line px-4 py-1">
              <KeyValue
                label="Source & level"
                value={
                  <span className="capitalize">
                    {selectedLogForDetails.source} · {selectedLogForDetails.level}
                  </span>
                }
              />
              <KeyValue
                label="Route / endpoint"
                value={<span className="break-all font-mono text-[12.5px]">{selectedLogForDetails.route || 'N/A'}</span>}
              />
              {selectedLogForDetails.requestId && (
                <KeyValue
                  label="Request ID"
                  value={<span className="break-all font-mono text-[12.5px]">{selectedLogForDetails.requestId}</span>}
                />
              )}
            </div>

            {selectedLogForDetails.details != null && (
              <div className="space-y-1.5">
                <span className="block text-[13px] font-semibold text-ink-2">Context / details payload</span>
                <pre className="well max-h-48 overflow-x-auto whitespace-pre-wrap p-3.5 font-mono text-[11.5px] leading-relaxed text-ink-2">
                  {typeof selectedLogForDetails.details === 'object'
                    ? JSON.stringify(selectedLogForDetails.details, null, 2)
                    : String(selectedLogForDetails.details)}
                </pre>
              </div>
            )}

            {selectedLogForDetails.stack && (
              <div className="space-y-1.5">
                <span className="block text-[13px] font-semibold text-ink-2">Stack trace</span>
                <pre className="well max-h-56 overflow-x-auto whitespace-pre-wrap p-3.5 font-mono text-[11px] leading-relaxed text-ink-2">
                  {selectedLogForDetails.stack}
                </pre>
              </div>
            )}

            {selectedLogForDetails.userAgent && (
              <div className="space-y-1.5">
                <span className="block text-[13px] font-semibold text-ink-2">User agent</span>
                <p className="well break-all px-3.5 py-2.5 font-mono text-[11px] text-muted">
                  {selectedLogForDetails.userAgent}
                </p>
              </div>
            )}
          </div>
        </Drawer>
      )}
      {confirmDialogEl}
    </div>
  );
}
