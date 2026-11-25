'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Lock,
  Mail,
  Search,
  ExternalLink,
  LogOut,
  Copy,
  Layers,
  Building,
  CheckCircle2,
  Clock,
  Phone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Terminal,
  Bug,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { AdminSupportPanel } from '@/components/support/AdminSupportPanel';
import { AdminPgFeatures } from '@/components/admin/AdminPgFeatures';
import { AdminPgManage } from '@/components/admin/AdminPgManage';
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
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { Drawer } from '@/components/ui/drawer';
import { formatCurrency } from '@/lib/utils';
import type { SuperAdminPgOverview } from '@/lib/server/services/adminOverview.service';
import { config } from '@/lib/config';
import { Avatar } from '@/components/ui/avatar';
import { StatusDot } from '@/components/ui/status-dot';
import { DataTable, Column } from '@/components/ui/data-table';
import { Tenant } from '@/types';
import toast from 'react-hot-toast';
import Link from 'next/link';

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
  const [stats, setStats] = useState<{
    allPgs: SuperAdminPgOverview[];
    platformTotalPgs: number;
    platformTotalBeds: number;
    platformTotalResidents: number;
    platformTotalVolume: number;
    nextCursor?: string | null;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPgId, setSelectedPgId] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'telemetry' | 'upgrades' | 'logs' | 'support'>('telemetry');
  const [upgradeRequests, setUpgradeRequests] = useState<any[]>([]);
  const [loadingUpgrades, setLoadingUpgrades] = useState(false);

  // System & Error Logs State
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<any | null>(null);

  const loadLogs = async (level = logFilter) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/admin/logs?level=${level}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setSystemLogs(data.logs || []);
      }
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
      const res = await fetch('/api/admin/subscriptions');
      if (res.ok) {
        const data = await res.json();
        setUpgradeRequests(data.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUpgrades(false);
    }
  };

  const handleApproveUpgrade = async (requestId: string) => {
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Approval failed');
      toast.success('Subscription plan upgraded successfully');
      await loadUpgrades();
      await loadPlatformData();
    } catch (e: any) {
      toast.error(e.message || 'Could not approve upgrade');
    }
  };

  const handleToggleAccountStatus = async (ownerId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    if (!confirm(`Are you sure you want to change account status to ${newStatus}?`)) return;

    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, accountStatus: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status update failed');
      toast.success(`Account status set to ${newStatus}`);
      await loadPlatformData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update account status');
    }
  };

  // Listen to Firebase Auth state and verify the admin custom claim before
  // treating the session as an admin session.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
        if (admin) {
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
  }, []);

  const loadPlatformData = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/admin/overview');
      if (!res.ok) {
        throw new Error('Failed to load platform telemetry');
      }
      const data = await res.json();
      setStats(data);
      if (data.allPgs.length > 0 && !selectedPgId) {
        setSelectedPgId(data.allPgs[0].owner.id);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load platform telemetry');
    } finally {
      setLoadingStats(false);
    }
  };

  // Load the next page of PGs (cursor pagination) and append to the directory.
  const loadMorePgs = async () => {
    if (!stats?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/overview?cursor=${encodeURIComponent(stats.nextCursor)}`);
      if (!res.ok) throw new Error('Failed to load more PGs');
      const data = await res.json();
      setStats((prev) =>
        prev
          ? { ...data, allPgs: [...prev.allPgs, ...data.allPgs] }
          : data
      );
    } catch (e: any) {
      toast.error(e.message || 'Could not load more PGs');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);

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
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        throw new Error('Failed to establish secure session cookie');
      }
      setIsAdmin(true);
      toast.success('Admin authenticated successfully');
    } catch (err: any) {
      console.error(err);
      let msg = 'Authentication failed. Please check your admin credentials.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        msg = 'Invalid email or password. Access denied.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-in is not enabled in Firebase Console. Please enable it in Authentication -> Sign-in method.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please wait a few minutes.';
      } else if (err.message) {
        msg = err.message;
      }
      setAuthError(msg);
      toast.error(msg);
    } finally {
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
    } catch (e) {
      toast.error('Error signing out');
    }
  };

  const handleCopyLink = (token?: string) => {
    if (!token) return;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    navigator.clipboard.writeText(`${baseUrl}/t/${token}`);
    toast.success('Resident link copied');
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '••••';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 4) return '••••';
    return `•••${clean.slice(-4)}`;
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-[#64748B]">Checking admin credentials...</span>
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
      <div className="theme-admin min-h-screen app-gradient-tint text-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm app-card p-8 text-center text-left animate-pop">
          <div className="w-12 h-12 rounded-[14px] accent-soft-bg flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5" />
          </div>

          <div className="text-center mb-6">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest accent-text accent-soft-bg px-2.5 py-0.5 rounded-[6px] inline-block mb-1.5">
              Restricted Area
            </span>
            <h1 className="text-xl font-bold text-[#09090B] tracking-tight">
              PGPass Super Admin
            </h1>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Sign in with your authorized admin email and password.
            </p>
          </div>

          {signedInButNotAdmin && (
            <div className="mb-5 p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FECACA] text-left space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-[#991B1B] leading-relaxed">
                  You are signed in, but this account is not an authorized administrator.
                  The admin console is restricted to provisioned admin accounts.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href="/dashboard"
                  className="flex-1 text-center text-xs font-bold text-[#D97706] hover:underline"
                >
                  Go to Owner Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="flex-1 text-center text-xs font-bold text-[#64748B] hover:text-[#09090B]"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <Input
              label="Admin Email Address"
              type="email"
              placeholder="admin@yourdomain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              disabled={submitting}
            />

            <Input
              label="Admin Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />

            {authError && (
              <div className="p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FECACA] text-xs font-semibold text-[#991B1B] animate-shake">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              variant="solid"
              loading={submitting}
              className="w-full text-xs font-semibold"
            >
              Sign In to Admin Console
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <span className="text-[11px] text-[#94A3B8]">Authorized Personnel Only</span>
            <Link href="/" className="hover:text-[#09090B] font-semibold transition-colors">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- AUTHENTICATED ADMIN DASHBOARD ----------------
  const allPgs = stats?.allPgs || [];
  const filteredPgs = allPgs.filter((pg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      pg.owner.pgName.toLowerCase().includes(q) ||
      pg.owner.name.toLowerCase().includes(q) ||
      pg.owner.phone.includes(q)
    );
  });

  const selectedPg = allPgs.find((p) => p.owner.id === selectedPgId) || allPgs[0];

  const residentColumns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Resident',
      sortable: true,
      render: (t) => (
        <span className="font-bold text-[#09090B] text-xs">{t.name}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Masked Phone',
      render: (t) => (
        <span className="font-mono text-xs text-[#64748B]">
          +91 {maskPhone(t.phone)}
        </span>
      ),
    },
    {
      key: 'bedLabel',
      header: 'Unit',
      sortable: true,
      render: (t) => (
        <span className="font-mono text-xs px-2 py-0.5 rounded-[6px] bg-[#F1F5F9] border border-[#E2E8F0] text-[#09090B] font-semibold">
          {t.bedLabel || 'Bed'}
        </span>
      ),
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      sortable: true,
      align: 'right',
      render: (t) => (
        <span className="font-mono text-xs font-bold text-[#09090B]">
          {formatCurrency(t.monthlyRent || 0)}
        </span>
      ),
    },
    {
      key: 'token',
      header: 'Portal Link',
      align: 'center',
      render: (t) => (
        <button
          type="button"
          onClick={() => handleCopyLink(t.token)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D97706] hover:underline cursor-pointer"
        >
          <Copy className="w-3 h-3" />
          <span>Copy URL</span>
        </button>
      ),
    },
  ];

  return (
    <div className="theme-admin min-h-screen app-gradient-tint text-slate-900 flex flex-col font-sans">
      <IdleLogout role="admin" redirectTo="/admin" />
      {/* Gradient header */}
      <header className="app-gradient px-5 sm:px-6 py-4 flex items-center justify-between shadow-[0_8px_24px_-12px_rgba(79,70,229,0.5)]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[12px] bg-white/20 backdrop-blur text-white flex items-center justify-center font-extrabold text-xs">
            PG
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white block leading-none">
              PGPass Platform
            </span>
            <span className="text-[10px] text-white/70 font-mono mt-0.5 block">
              {currentUser.email}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdminLogout}
          className="flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition-colors press"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </header>

      {/* Metric Bar (Horizontal Bento Live HUD) */}
      <div className="border-b border-[#E2E8F0] bg-white px-6 py-3.5 flex items-center gap-8 overflow-x-auto text-xs">
        <div className="flex items-baseline gap-2">
          <span className="text-[#64748B] uppercase text-[10px] font-bold">Total PGs:</span>
          <span className="font-mono text-base font-bold text-[#09090B]">
            {stats?.platformTotalPgs || 0}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[#64748B] uppercase text-[10px] font-bold">Total Beds:</span>
          <span className="font-mono text-base font-bold text-[#09090B]">
            {stats?.platformTotalBeds || 0}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[#64748B] uppercase text-[10px] font-bold">Active Residents:</span>
          <span className="font-mono text-base font-bold text-[#10B981]">
            {stats?.platformTotalResidents || 0}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[#64748B] uppercase text-[10px] font-bold">
            Volume (loaded PGs):
          </span>
          <span className="font-mono text-base font-bold text-[#D97706]">
            {formatCurrency(stats?.platformTotalVolume || 0)}
          </span>
        </div>
      </div>

      {/* Admin Navigation Tabs — horizontally scrollable on small screens so all
          tabs remain reachable without wrapping or clipping. */}
      <div className="border-b border-[#E2E8F0] bg-white px-4 sm:px-6 flex items-center gap-5 sm:gap-6 text-xs font-semibold overflow-x-auto whitespace-nowrap no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('telemetry')}
          className={`py-3 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'telemetry'
              ? 'border-[#D97706] text-[#D97706]'
              : 'border-transparent text-[#64748B] hover:text-[#09090B]'
          }`}
        >
          PG Directory & Telemetry
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('upgrades');
            loadUpgrades();
          }}
          className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'upgrades'
              ? 'border-[#D97706] text-[#D97706]'
              : 'border-transparent text-[#64748B] hover:text-[#09090B]'
          }`}
        >
          <span>SaaS Upgrade Requests</span>
          {upgradeRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FEF3C7] text-[#D97706] font-bold">
              {upgradeRequests.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('logs');
            loadLogs();
          }}
          className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'logs'
              ? 'border-[#D97706] text-[#D97706]'
              : 'border-transparent text-[#64748B] hover:text-[#09090B]'
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>System & Error Logs</span>
          {systemLogs.filter((l) => l.level === 'error').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FEE2E2] text-[#DC2626] font-bold">
              {systemLogs.filter((l) => l.level === 'error').length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('support')}
          className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'support'
              ? 'border-[#D97706] text-[#D97706]'
              : 'border-transparent text-[#64748B] hover:text-[#09090B]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Owner Support</span>
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'support' ? (
        <AdminSupportPanel />
      ) : activeTab === 'upgrades' ? (
        <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-4 text-left">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#09090B]">
                Pending SaaS Subscription Upgrades
              </h2>
              <p className="text-xs text-[#64748B]">
                Verify direct UPI UTR settlements and activate owner Growth / Pro quotas.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadUpgrades}
              loading={loadingUpgrades}
            >
              Refresh
            </Button>
          </div>

          {upgradeRequests.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-8 text-center text-xs text-[#64748B]">
              No pending upgrade requests. All accounts are on authorized tiers.
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] divide-y divide-[#E2E8F0] shadow-xs">
              {upgradeRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#09090B]">
                        Owner ID: {req.ownerId?.slice(0, 8)}...
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-[4px] bg-[#FEF3C7] text-[#D97706]">
                        {req.requestedPlan} ({req.billingCycle})
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#10B981]">
                        {formatCurrency((req.amountPaise || 0) / 100)}
                      </span>
                    </div>
                    <div className="text-[#64748B] flex items-center gap-2">
                      <span>Submitted UTR:</span>
                      <strong className="font-mono text-[#09090B]">
                        {req.utrReference}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.status === 'approved' ? (
                      <span className="text-xs font-bold text-[#10B981] bg-[#ECFDF5] px-2.5 py-1 rounded-[6px]">
                        Approved
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="solid"
                        onClick={() => handleApproveUpgrade(req.id)}
                        className="bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold"
                      >
                        Approve & Activate Quotas
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'logs' ? (
        <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full space-y-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#09090B] flex items-center gap-2">
                <Bug className="w-4 h-4 text-[#DC2626]" />
                <span>System Error Logs & Diagnostics</span>
              </h2>
              <p className="text-xs text-[#64748B]">
                Real-time technical errors, Firebase auth exceptions, and server diagnostics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dropdown
                aria-label="Filter logs by level"
                value={logFilter}
                onChange={(v) => {
                  setLogFilter(v);
                  loadLogs(v);
                }}
                containerClassName="w-40"
                className="h-9 text-xs font-medium"
                options={[
                  { value: 'all', label: 'All Levels' },
                  { value: 'error', label: 'Errors Only' },
                  { value: 'warn', label: 'Warnings Only' },
                  { value: 'info', label: 'Info Only' },
                ]}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadLogs(logFilter)}
                loading={loadingLogs}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {systemLogs.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto" />
              <p className="text-xs font-semibold text-[#09090B]">No System Errors Detected</p>
              <p className="text-[11px] text-[#64748B]">All cloud services, authentications, and APIs are operating normally.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3.5">Level</th>
                      <th className="py-2.5 px-3.5">Source</th>
                      <th className="py-2.5 px-3.5">Code / Route</th>
                      <th className="py-2.5 px-3.5">Message</th>
                      <th className="py-2.5 px-3.5">Timestamp</th>
                      <th className="py-2.5 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {systemLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-[4px] ${
                              log.level === 'error'
                                ? 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]'
                                : log.level === 'warn'
                                ? 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]'
                                : 'bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]'
                            }`}
                          >
                            {log.level}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-[#475569]">
                          {log.source === 'client' ? '🌐 Client' : '⚡ Server'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className="font-mono font-bold text-[#09090B] block text-[11px]">
                            {log.code || 'UNKNOWN'}
                          </span>
                          <span className="font-mono text-[10px] text-[#64748B]">
                            {log.route || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 max-w-xs truncate text-[#09090B] font-medium" title={log.message}>
                          {log.message}
                        </td>
                        <td className="py-2.5 px-3.5 text-[11px] text-[#64748B] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLogForDetails(log)}
                            className="text-[#D97706] hover:text-[#B45309] font-bold text-xs hover:underline cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Master List: PGs — full width on mobile (bounded height so the
              detail panel stays reachable below), fixed sidebar on desktop. */}
          <aside className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-[#E2E8F0] bg-white flex flex-col max-h-64 md:max-h-none">
            {/* Search bar */}
            <div className="p-3 border-b border-[#E2E8F0]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search PG or owner..."
                  className="w-full h-8.5 pl-8 pr-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] text-xs text-[#09090B] placeholder-[#94A3B8] focus:outline-none focus:border-[#D97706]"
                />
              </div>
            </div>

            {/* List items */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0]">
              {filteredPgs.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#94A3B8]">
                  No PGs registered yet.
                </div>
              ) : (
                filteredPgs.map((pg) => {
                  const isSelected = selectedPg?.owner.id === pg.owner.id;
                  return (
                    <button
                      key={pg.owner.id}
                      type="button"
                      onClick={() => setSelectedPgId(pg.owner.id)}
                      className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-[#FEF3C7] border-l-3 border-[#D97706]'
                          : 'hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <Avatar name={pg.owner.pgName} size="md" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-[#09090B] block truncate">
                          {pg.owner.pgName}
                        </span>
                        <span className="text-[11px] text-[#64748B] block truncate">
                          {pg.owner.name} · {pg.owner.phone}
                        </span>
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-[#64748B]">
                          <span>{pg.beds.length} beds</span>
                          <span>•</span>
                          <span className="text-[#10B981] font-semibold">{pg.tenants.length} occupied</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}

              {/* Cursor pagination — only when not filtering a search locally. */}
              {stats?.nextCursor && !searchQuery.trim() && (
                <button
                  type="button"
                  onClick={loadMorePgs}
                  disabled={loadingMore}
                  className="w-full py-3 text-xs font-semibold text-[#D97706] hover:bg-[#FEF3C7] transition-colors disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more PGs'}
                </button>
              )}
            </div>
          </aside>

          {/* Right Detail Panel: Selected PG */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedPg ? (
              <div className="space-y-6 text-left">
                {/* Selected PG Header */}
                <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-[#09090B] tracking-tight">
                        {selectedPg.owner.pgName}
                      </h2>
                      <span className="text-[10px] font-mono uppercase bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-[4px] border border-[#FDE68A]">
                        ID: {selectedPg.owner.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Owner: {selectedPg.owner.name} · Phone: {selectedPg.owner.phone} · UPI: {selectedPg.owner.upiId || 'None'}
                    </p>
                    {selectedPg.owner.pgAddress && (
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">
                        {selectedPg.owner.pgAddress}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-[#64748B] block">Default Rent</span>
                        <span className="text-sm font-bold text-[#09090B]">
                          {formatCurrency(selectedPg.owner.monthlyRent || 0)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-[#64748B] block">Units / Occ.</span>
                        <span className="text-sm font-bold text-[#10B981]">
                          {selectedPg.tenants.length} / {selectedPg.beds.length}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleAccountStatus(selectedPg.owner.id, selectedPg.owner.accountStatus || 'active')}
                      className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold border transition-colors cursor-pointer ${
                        selectedPg.owner.accountStatus === 'suspended'
                          ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] hover:bg-[#D1FAE5]'
                          : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626] hover:bg-[#FEE2E2]'
                      }`}
                    >
                      {selectedPg.owner.accountStatus === 'suspended' ? 'Reactivate PG' : 'Suspend Account'}
                    </button>
                  </div>
                </div>

                {/* Mini Bed Occupancy Matrix */}
                <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4.5 space-y-2 shadow-xs">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    Unit Occupancy Matrix ({selectedPg.beds.length} Total Beds)
                  </span>
                  {selectedPg.beds.length >= 500 && (
                    <span className="block text-[10px] text-[#2563EB] font-semibold">
                      Showing the first 500 beds for this PG (admin detail is windowed).
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedPg.beds.map((bed) => {
                      const isOcc = bed.status !== 'vacant';
                      return (
                        <div
                          key={bed.id}
                          title={`Bed ${bed.bedLabel}: ${isOcc ? bed.tenantName || 'Occupied' : 'Vacant'}`}
                          className={`h-5 w-5 rounded-[4px] flex items-center justify-center text-[9px] font-mono font-bold select-none cursor-default ${
                            isOcc
                              ? 'bg-[#10B981] text-white'
                              : 'bg-[#F1F5F9] border border-[#E2E8F0] text-[#94A3B8]'
                          }`}
                        >
                          {bed.bedLabel.slice(-1)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Per-PG feature access control (admin, server-enforced) */}
                <AdminPgFeatures ownerId={selectedPg.owner.id} />

                {/* Admin act-as-owner management + full history */}
                <AdminPgManage pg={selectedPg} onChanged={loadPlatformData} />

                {/* Resident Data Table */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    Active Leaseholders ({selectedPg.tenants.length})
                  </span>
                  <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-xs">
                    <DataTable
                      columns={residentColumns}
                      data={selectedPg.tenants}
                      keyExtractor={(t) => t.id}
                      emptyText="No residents currently registered in this PG."
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                Select a PG from the directory to inspect telemetry.
              </div>
            )}
          </main>
        </div>
      )}

      {/* ERROR LOG INSPECT DRAWER */}
      {selectedLogForDetails && (
        <Drawer
          isOpen={!!selectedLogForDetails}
          onClose={() => setSelectedLogForDetails(null)}
          title={`Error Diagnostics: ${selectedLogForDetails.code || selectedLogForDetails.level.toUpperCase()}`}
          description={`Captured at ${new Date(selectedLogForDetails.createdAt).toLocaleString('en-IN')}`}
          width="lg"
          footer={
            <Button variant="outline" size="sm" onClick={() => setSelectedLogForDetails(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs text-left">
            <div>
              <span className="text-[11px] font-bold text-[#64748B] uppercase block mb-1">
                Error Message
              </span>
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-[6px] font-mono leading-relaxed break-words">
                {selectedLogForDetails.message}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
                <span className="text-[#64748B] block font-semibold">Source & Level</span>
                <span className="font-bold text-[#09090B] uppercase">
                  {selectedLogForDetails.source} · {selectedLogForDetails.level}
                </span>
              </div>
              <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
                <span className="text-[#64748B] block font-semibold">Route / Endpoint</span>
                <span className="font-mono text-[#09090B] truncate block">
                  {selectedLogForDetails.route || 'N/A'}
                </span>
              </div>
            </div>

            {selectedLogForDetails.requestId && (
              <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] text-[11px]">
                <span className="text-[#64748B] block font-semibold">Request ID</span>
                <span className="font-mono text-[#09090B]">
                  {selectedLogForDetails.requestId}
                </span>
              </div>
            )}

            {selectedLogForDetails.details && (
              <div>
                <span className="text-[11px] font-bold text-[#64748B] uppercase block mb-1">
                  Context / Details Payload
                </span>
                <pre className="p-3 bg-[#0F172A] text-[#E2E8F0] rounded-[6px] font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {typeof selectedLogForDetails.details === 'object'
                    ? JSON.stringify(selectedLogForDetails.details, null, 2)
                    : String(selectedLogForDetails.details)}
                </pre>
              </div>
            )}

            {selectedLogForDetails.stack && (
              <div>
                <span className="text-[11px] font-bold text-[#64748B] uppercase block mb-1">
                  Stack Trace
                </span>
                <pre className="p-3 bg-[#0F172A] text-[#94A3B8] rounded-[6px] font-mono text-[10px] overflow-x-auto max-h-56 whitespace-pre-wrap">
                  {selectedLogForDetails.stack}
                </pre>
              </div>
            )}

            {selectedLogForDetails.userAgent && (
              <div>
                <span className="text-[11px] font-bold text-[#64748B] uppercase block mb-1">
                  User Agent
                </span>
                <p className="font-mono text-[10px] text-[#64748B] break-all">
                  {selectedLogForDetails.userAgent}
                </p>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}
