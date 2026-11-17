'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Zap,
  Receipt,
  Grid3X3,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Users,
  Building2,
  FileText,
  Send,
  Camera,
  Check,
  Clock,
  ExternalLink,
  ChevronRight,
  IndianRupee,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

export default function LandingPage() {
  const router = useRouter();
  const { loginDemo } = useAuth();
  const [tenantTokenInput, setTenantTokenInput] = useState('');
  const [activeFlowTab, setActiveFlowTab] = useState<'owner' | 'resident'>('owner');

  // Interactive Live Bed Grid Simulator state
  const [selectedDemoBed, setSelectedDemoBed] = useState<{
    label: string;
    status: 'paid' | 'pending' | 'verify' | 'vacant';
    tenant?: string;
    rent: number;
    phone?: string;
  }>({
    label: '101-A',
    status: 'paid',
    tenant: 'Rahul Sharma',
    rent: 8500,
    phone: '9876543210',
  });

  const handleLaunchDemo = () => {
    loginDemo('+91 98765 43210', 'Sri Krishna Luxury PG');
    router.push('/dashboard');
  };

  const handleLookupTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (tenantTokenInput.trim()) {
      router.push(`/t/${tenantTokenInput.trim()}`);
    } else {
      router.push('/t/demo');
    }
  };

  const demoBeds = [
    { label: '101-A', status: 'paid' as const, tenant: 'Rahul Sharma', rent: 8500, phone: '9876543210' },
    { label: '101-B', status: 'pending' as const, tenant: 'Amit Verma', rent: 8500, phone: '9812345678' },
    { label: '101-C', status: 'vacant' as const, rent: 8500 },
    { label: '102-A', status: 'verify' as const, tenant: 'Vikas Rao', rent: 9000, phone: '9789012345' },
    { label: '102-B', status: 'paid' as const, tenant: 'Sneha Patel', rent: 9000, phone: '9945678901' },
    { label: '102-C', status: 'pending' as const, tenant: 'Kiran Deep', rent: 9000, phone: '9654321890' },
  ];

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Background radial gradients */}
      <div className="absolute top-[-140px] left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-gradient-to-r from-indigo-600/25 via-purple-600/20 to-blue-600/25 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-[800px] left-[-200px] w-[600px] h-[400px] bg-indigo-500/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute top-[1600px] right-[-200px] w-[600px] h-[400px] bg-purple-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Floating Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#070913]/80 border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-600/35 text-white font-black text-xl group-hover:scale-105 transition-transform">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-white">PGPass</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                  Zero Cost
                </span>
              </div>
              <span className="block text-[11px] text-slate-400 font-medium tracking-wide">
                Rent, Bed & HRA Manager
              </span>
            </div>
          </Link>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLaunchDemo}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>1-Click Demo</span>
            </button>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-5 pt-12 pb-24 relative z-10 flex flex-col items-center">
        {/* Top Announcement Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-indigo-500/30 text-slate-300 text-xs font-semibold mb-8 shadow-xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-emerald-400 font-bold">100% Free Forever</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Zero App Downloads</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Works on Any Phone</span>
        </div>

        {/* Hero Title & Subtitle */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white text-center max-w-4xl leading-[1.12] mb-6">
          The Cleanest Way to Run Your PG &{' '}
          <span className="gradient-title">Eliminate Rent Chaos</span>
        </h1>

        <p className="text-base sm:text-xl text-slate-300 text-center max-w-2xl leading-relaxed mb-10 font-normal">
          Visual bed occupancy grid, 1-tap WhatsApp rent reminders, move-in room photo vault, and instant HRA tax receipt
          generator — completely free.
        </p>

        {/* Dual Primary Call-to-Actions */}
        <div className="w-full max-w-md flex flex-col sm:flex-row gap-3.5 justify-center mb-16">
          <Link
            href="/login"
            className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/35 transition-all cursor-pointer text-center"
          >
            <Building2 className="w-4 h-4" />
            <span>PG Owner Login</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <button
            onClick={handleLaunchDemo}
            className="flex-1 py-4 px-6 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-100 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer text-center"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Launch Live Demo</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE LIVE BED GRID SIMULATOR (TRY IT DIRECTLY ON LANDING PAGE) */}
        {/* ========================================================================= */}
        <div className="w-full bg-slate-900/70 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl mb-20 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-5 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                  Interactive Live Simulator
                </span>
                <span className="text-xs text-slate-400 font-medium">Click any bed to test actions</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Live Bed Occupancy Map</h2>
            </div>

            {/* Status Legend */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Paid
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Pending
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Verify
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Vacant
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bed Matrix */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {demoBeds.map((bed) => {
                const isSelected = selectedDemoBed.label === bed.label;
                const isPaid = bed.status === 'paid';
                const isPending = bed.status === 'pending';
                const isVerify = bed.status === 'verify';
                const isVacant = bed.status === 'vacant';

                return (
                  <div
                    key={bed.label}
                    onClick={() => setSelectedDemoBed(bed)}
                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected ? 'ring-2 ring-indigo-500 scale-[1.02]' : ''
                    } ${
                      isPaid
                        ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                        : isPending
                        ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                        : isVerify
                        ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400 animate-pulse'
                        : 'bg-slate-900/40 border-dashed border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold text-sm text-white">{bed.label}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isPaid
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isPending
                              ? 'bg-rose-500/20 text-rose-300'
                              : isVerify
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {bed.status}
                        </span>
                      </div>

                      <div className="my-2">
                        {isVacant ? (
                          <span className="text-xs text-slate-500 font-medium">Ready for Booking</span>
                        ) : (
                          <div>
                            <span className="text-xs font-bold text-white block truncate">{bed.tenant}</span>
                            <span className="text-[11px] text-slate-400 font-mono">₹{bed.rent}/mo</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] font-semibold text-indigo-400 flex items-center justify-end gap-1 pt-2 border-t border-slate-800/80">
                      <span>View Actions</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Interactive Action Drawer */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Selected Bed Details
                </span>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black text-white">Bed {selectedDemoBed.label}</h3>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      selectedDemoBed.status === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : selectedDemoBed.status === 'pending'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : selectedDemoBed.status === 'verify'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {selectedDemoBed.status}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 mb-5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Resident:</span>
                    <span className="font-bold text-white">{selectedDemoBed.tenant || 'None (Vacant)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rent Due:</span>
                    <span className="font-bold text-white">₹{selectedDemoBed.rent.toLocaleString('en-IN')}/mo</span>
                  </div>
                  {selectedDemoBed.phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">WhatsApp:</span>
                      <span className="font-mono text-slate-300">+91 {selectedDemoBed.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contextual Action Simulator Buttons */}
              <div className="space-y-2">
                {selectedDemoBed.status === 'pending' && (
                  <button
                    onClick={() => alert(`Pre-filled WhatsApp reminder triggered for ${selectedDemoBed.tenant}!`)}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send WhatsApp Reminder</span>
                  </button>
                )}

                {selectedDemoBed.status === 'verify' && (
                  <button
                    onClick={() => alert('Opening payment proof screenshot inspector!')}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Payment Screenshot</span>
                  </button>
                )}

                {selectedDemoBed.status === 'paid' && (
                  <Link
                    href="/t/demo"
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer text-center"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Download Official HRA PDF</span>
                  </Link>
                )}

                {selectedDemoBed.status === 'vacant' && (
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Add New Resident</span>
                  </button>
                )}

                <button
                  onClick={handleLaunchDemo}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-800 transition-colors cursor-pointer"
                >
                  Open Full Dashboard →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP-BY-STEP USER FLOW (FOR OWNERS & RESIDENTS) */}
        {/* ========================================================================= */}
        <div className="w-full mb-20 text-left">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-black text-white mb-3">How PGPass Works (Clean & Simple)</h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              Select your perspective to see how PGPass removes daily friction for everyone.
            </p>

            {/* Toggle Switch */}
            <div className="inline-flex p-1 rounded-2xl bg-slate-900 border border-slate-800 mt-6">
              <button
                onClick={() => setActiveFlowTab('owner')}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeFlowTab === 'owner'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                For PG Owners & Caretakers
              </button>
              <button
                onClick={() => setActiveFlowTab('resident')}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeFlowTab === 'resident'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                For Salaried Residents
              </button>
            </div>
          </div>

          {activeFlowTab === 'owner' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Step 1 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-400 font-black text-lg flex items-center justify-center mb-4">
                    1
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">30-Second Setup</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Type your total floors, rooms per floor, and beds per room. Your live, color-coded visual bed matrix
                    generates automatically.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-indigo-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>No Excel or complex software</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 font-black text-lg flex items-center justify-center mb-4">
                    2
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">1-Tap WhatsApp Reminders</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    On the 1st of the month, tap "Remind All Pending". WhatsApp opens on your phone with pre-filled messages
                    containing individual resident portal links.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero WhatsApp API or bot charges</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 font-black text-lg flex items-center justify-center mb-4">
                    3
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">1-Click Proof Approval</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    When residents upload UPI screenshots, beds turn yellow (Verify). Review the screenshot and tap "Approve"
                    to automatically mark the bed paid and generate their HRA receipt.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Complete payment audit trail</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Resident Step 1 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 font-black text-lg flex items-center justify-center mb-4">
                    1
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">Direct UPI Payment</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Open your personal link from WhatsApp without creating passwords. Copy the landlord's verified UPI ID or
                    scan the QR code directly via GPay / PhonePe.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-purple-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero convenience fees or deductions</span>
                </div>
              </div>

              {/* Resident Step 2 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 font-black text-lg flex items-center justify-center mb-4">
                    2
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">Instant HRA Tax Receipt</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Once cleared, download an official Form 12BB compliant PDF rent receipt with landlord PAN number, revenue
                    stamp simulation, and Section 10(13A) declaration for your company IT declaration.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ready for employer IT portals</span>
                </div>
              </div>

              {/* Resident Step 3 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 font-black text-lg flex items-center justify-center mb-4">
                    3
                  </div>
                  <h3 className="font-bold text-base text-white mb-2">Security Deposit Protection</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Snap photos of existing wall cracks, furniture chips, or bathroom conditions on Day 1. Stored with a
                    permanent timestamp and shareable on WhatsApp to prevent unfair checkout deductions.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-blue-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Protects your ₹8,000 - ₹20,000 deposit</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RESIDENT QUICK LOOKUP BAR */}
        {/* ========================================================================= */}
        <div className="w-full max-w-lg bg-slate-900/80 border border-indigo-500/20 rounded-3xl p-6 shadow-2xl mb-20 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" />
              Resident Quick Portal Lookup
            </span>
            <span className="text-[11px] text-slate-500">No Login Required</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Received your rent link from your PG owner? Paste your link token below to view rent status or download receipts.
          </p>

          <form onSubmit={handleLookupTenant} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. demo or paste 12-char token"
              value={tenantTokenInput}
              onChange={(e) => setTenantTokenInput(e.target.value)}
              className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button type="submit" size="sm" variant="default" className="text-xs px-5 font-bold">
              Open Portal
            </Button>
          </form>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
            <span>Want to test resident view?</span>
            <Link href="/t/demo" className="text-indigo-400 font-bold hover:underline">
              Open Demo Resident Portal →
            </Link>
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="w-full bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <h3 className="text-2xl sm:text-4xl font-black text-white mb-3">
            Ready to upgrade your PG operations?
          </h3>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
            Join hundreds of PG caretakers in Madhapur, Whitefield, and Koramangala saving 10+ hours every month.
          </p>
          <div className="flex flex-col sm:flex-row gap-3.5 justify-center">
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 transition-all text-center"
            >
              Get Started for Free
            </Link>
            <button
              onClick={handleLaunchDemo}
              className="px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm transition-all text-center"
            >
              ⚡ Instant 1-Click Demo
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 py-8 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
              P
            </div>
            <span className="font-bold text-slate-300">PGPass India</span>
            <span className="text-slate-600">•</span>
            <span>Zero-Cost PG Rent & Bed Management Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1 font-semibold"
            >
              <span>Platform Admin</span>
            </Link>
            <p>© {new Date().getFullYear()} PGPass. Free Forever.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
