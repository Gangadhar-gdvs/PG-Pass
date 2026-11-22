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
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import {
  getSuperAdminPlatformOverview,
  SuperAdminPgOverview,
} from '@/lib/firestore';
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
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPgId, setSelectedPgId] = useState<string | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsInitializing(false);
      if (user) {
        await loadPlatformData();
      } else {
        setStats(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadPlatformData = async () => {
    setLoadingStats(true);
    try {
      const data = await getSuperAdminPlatformOverview();
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

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
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
      await signOut(auth);
      setCurrentUser(null);
      setStats(null);
      setEmail('');
      setPassword('');
      toast.success('Admin session ended');
    } catch (e) {
      toast.error('Error signing out');
    }
  };

  const handleCopyLink = (token: string) => {
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

  // ---------------- AUTHENTICATION GATE (STRICT LOGIN ONLY - NO PUBLIC REGISTRATION) ----------------
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#09090B] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-[14px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] text-center text-left">
          <div className="w-12 h-12 rounded-[10px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5" />
          </div>

          <div className="text-center mb-6">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D97706] bg-[#FEF3C7] px-2.5 py-0.5 rounded-[4px] inline-block mb-1.5">
              Restricted Area
            </span>
            <h1 className="text-xl font-bold text-[#09090B] tracking-tight">
              PGPass Super Admin
            </h1>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Sign in with your authorized admin email and password.
            </p>
          </div>

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
    <div className="min-h-screen bg-[#F8FAFC] text-[#09090B] flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-[#E2E8F0] bg-white px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[8px] bg-[#D97706] text-white flex items-center justify-center font-bold text-xs">
            PG
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-[#09090B] block leading-none">
              PGPass Platform Telemetry
            </span>
            <span className="text-[10px] text-[#64748B] font-mono mt-0.5 block">
              Signed in as: <strong className="text-[#09090B]">{currentUser.email}</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdminLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:text-[#EF4444] hover:bg-[#FEF2F2] hover:border-[#FECACA] transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Session</span>
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
          <span className="text-[#64748B] uppercase text-[10px] font-bold">Gross Monthly Volume:</span>
          <span className="font-mono text-base font-bold text-[#D97706]">
            {formatCurrency(stats?.platformTotalVolume || 0)}
          </span>
        </div>
      </div>

      {/* Main Master-Detail Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Master List: PGs */}
        <aside className="w-80 shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col">
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
              </div>

              {/* Mini Bed Occupancy Matrix */}
              <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4.5 space-y-2 shadow-xs">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                  Unit Occupancy Matrix ({selectedPg.beds.length} Total Beds)
                </span>
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
    </div>
  );
}
