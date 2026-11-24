'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building,
  ArrowRight,
  CheckCircle2,
  Send,
  Camera,
  FileCheck,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export default function LandingPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      toast.error('Please enter your 12-character resident portal token');
      return;
    }
    router.push(`/t/${token}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#09090B] flex flex-col font-sans selection:bg-[#FEF3C7] selection:text-[#B45309]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#D97706] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Building className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="font-bold text-sm tracking-tight text-[#09090B] block leading-none">
                PGPass
              </span>
              <span className="text-[10px] text-[#D97706] font-semibold tracking-wide uppercase mt-0.5 block">
                Bento Hospitality
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <a
              href="#resident-lookup"
              className="hidden sm:inline-flex text-xs font-semibold text-[#64748B] hover:text-[#09090B] transition-colors"
            >
              Resident Lookup
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-xs font-semibold text-white bg-[#D97706] hover:bg-[#B45309] shadow-xs transition-colors"
            >
              <span>Owner Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* HERO SECTION — SPLIT LAYOUT */}
        <section className="max-w-6xl mx-auto px-5 pt-12 sm:pt-20 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] bg-[#FEF3C7] text-[#92400E] text-[11px] font-semibold tracking-wide border border-[#FDE68A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
              <span>Zero App Downloads · 100% Free for PG Owners</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[46px] font-extrabold tracking-tight text-[#09090B] leading-[1.16]">
              Modern PG management & instant rent settlement.
            </h1>

            <p className="text-sm sm:text-base text-[#475569] leading-relaxed max-w-xl">
              Eliminate notebook records and WhatsApp chaos. Get a live visual bed inventory, 1-tap WhatsApp payment reminders, and instant HRA tax receipts for your residents.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] bg-[#D97706] hover:bg-[#B45309] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
              >
                <span>Open PG Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#09090B] text-xs sm:text-sm font-semibold transition-colors"
              >
                <span>How It Works</span>
              </a>
            </div>

            <div className="pt-2 flex items-center gap-6 text-[11px] text-[#64748B]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                Direct P2P UPI transfers
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                Full IT Act 10(13A) HRA receipts
              </span>
            </div>
          </div>

          {/* Right Preview Frame Column */}
          <div className="lg:col-span-5 text-left">
            <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-4">
              {/* Mock Top bar */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div>
                  <span className="text-xs font-bold text-[#09090B] block">
                    Skyline Luxury Coliving
                  </span>
                  <span className="text-[10px] text-[#64748B]">Madhapur, Hyderabad</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px] bg-[#FEF3C7] text-[#92400E]">
                  24 Beds · 81% Occ.
                </span>
              </div>

              {/* Metric Row */}
              <div className="grid grid-cols-3 gap-2 text-left">
                <div className="p-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[10px] uppercase font-semibold text-[#64748B] block">Occupied</span>
                  <span className="text-sm font-bold font-mono text-[#09090B]">18 / 24</span>
                </div>
                <div className="p-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[10px] uppercase font-semibold text-[#64748B] block">Collected</span>
                  <span className="text-sm font-bold font-mono text-[#10B981]">₹1.53L</span>
                </div>
                <div className="p-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                  <span className="text-[10px] uppercase font-semibold text-[#64748B] block">Pending</span>
                  <span className="text-sm font-bold font-mono text-[#D97706]">₹25.5K</span>
                </div>
              </div>

              {/* Sample Bed Matrix */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#64748B]">
                  Floor 1 · Live Units
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative p-2 rounded-[8px] border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#10B981]" />
                    <span className="font-mono text-[11px] font-bold text-[#09090B] block pl-1">101-A</span>
                    <span className="text-[10px] text-[#475569] block pl-1 truncate">Rahul S.</span>
                    <span className="text-[9px] text-[#10B981] font-semibold block pl-1">● Paid</span>
                  </div>

                  <div className="relative p-2 rounded-[8px] border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#F59E0B]" />
                    <span className="font-mono text-[11px] font-bold text-[#09090B] block pl-1">101-B</span>
                    <span className="text-[10px] text-[#475569] block pl-1 truncate">Amit V.</span>
                    <span className="text-[9px] text-[#D97706] font-semibold block pl-1">● Due</span>
                  </div>

                  <div className="relative p-2 rounded-[8px] border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#CBD5E1]" />
                    <span className="font-mono text-[11px] font-bold text-[#09090B] block pl-1">101-C</span>
                    <span className="text-[10px] text-[#94A3B8] block pl-1">Vacant</span>
                    <span className="text-[9px] text-[#64748B] font-mono block pl-1">₹8.5K</span>
                  </div>
                </div>
              </div>

              {/* WhatsApp Reminder preview snippet */}
              <div className="p-3 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="text-[11px] font-semibold text-[#065F46]">
                    1-Tap WhatsApp Reminder ready
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#10B981]">Zero Fee</span>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <section className="border-y border-[#E2E8F0] bg-white py-6">
          <div className="max-w-6xl mx-auto px-5 flex flex-wrap items-center justify-around gap-6 text-center">
            <div>
              <span className="text-xl font-bold font-mono text-[#09090B] block">200+</span>
              <span className="text-xs text-[#64748B]">PGs Managed</span>
            </div>
            <div className="h-6 w-px bg-[#E2E8F0] hidden sm:block" />
            <div>
              <span className="text-xl font-bold font-mono text-[#09090B] block">₹2.4 Crore+</span>
              <span className="text-xs text-[#64748B]">Rent Tracked</span>
            </div>
            <div className="h-6 w-px bg-[#E2E8F0] hidden sm:block" />
            <div>
              <span className="text-xl font-bold font-mono text-[#09090B] block">0</span>
              <span className="text-xs text-[#64748B]">App Downloads Required</span>
            </div>
            <div className="h-6 w-px bg-[#E2E8F0] hidden sm:block" />
            <div>
              <span className="text-xl font-bold font-mono text-[#10B981] block">100%</span>
              <span className="text-xs text-[#64748B]">Free Forever</span>
            </div>
          </div>
        </section>

        {/* ASYMMETRIC BENTO GRID FEATURES */}
        <section className="max-w-6xl mx-auto px-5 py-20 text-left">
          <div className="text-center max-w-xl mx-auto mb-14 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#09090B] tracking-tight">
              Engineered specifically for Indian PG owners.
            </h2>
            <p className="text-xs sm:text-sm text-[#475569]">
              Everything you need to manage beds, collect rents directly into your bank, and protect deposits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bento Card 1: Large Span 2 */}
            <div className="md:col-span-2 rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-[8px] bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-3">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#09090B]">
                  Visual Bed Inventory Matrix
                </h3>
                <p className="text-xs text-[#475569] mt-1 max-w-lg leading-relaxed">
                  See every room and bed organized cleanly by floor. Color status indicators let you know instantly who has paid, who is pending, and which beds are vacant.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center gap-4 text-xs font-mono text-[#64748B]">
                <span>● Green: Paid</span>
                <span>● Amber: Due</span>
                <span>● Indigo: Verification</span>
                <span>○ Platinum: Vacant</span>
              </div>
            </div>

            {/* Bento Card 2: 1-Tap Reminders */}
            <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-[8px] bg-[#ECFDF5] text-[#10B981] flex items-center justify-center mb-3">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#09090B]">
                  1-Tap WhatsApp Reminders
                </h3>
                <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                  No awkward phone calls. Tap send to open WhatsApp with a polite pre-written message containing your UPI ID and the resident’s private portal link.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8F0] text-[11px] text-[#10B981] font-semibold">
                Uses WhatsApp directly on your phone
              </div>
            </div>

            {/* Bento Card 3: HRA Receipts */}
            <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-[8px] bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center mb-3">
                  <FileCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#09090B]">
                  Instant HRA Tax Receipts
                </h3>
                <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                  Tenants generate PDF rent certificates with your PAN and PG address in 1 click for their IT tax savings. Zero manual paperwork for you.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8F0] text-[11px] text-[#6366F1] font-semibold">
                IT Act Section 10(13A) compliant
              </div>
            </div>

            {/* Bento Card 4: Large Span 2 */}
            <div className="md:col-span-2 rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-[8px] bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-3">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#09090B]">
                  Move-In Condition Photo Vault
                </h3>
                <p className="text-xs text-[#475569] mt-1 max-w-lg leading-relaxed">
                  Residents document wall marks, tile cracks, and appliance state on Day 1. Timestamped photos in a tamper-proof cloud vault protect both resident deposits and owner property integrity.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center gap-2 text-xs text-[#64748B]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Zero deposit disputes upon checkout</span>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS TIMELINE */}
        <section id="how-it-works" className="border-t border-[#E2E8F0] bg-white py-16 text-left">
          <div className="max-w-6xl mx-auto px-5">
            <div className="text-center max-w-lg mx-auto mb-12 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                Workflow
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#09090B]">
                Up and running in 3 simple steps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#F8FAFC] rounded-[10px] p-5 border border-[#E2E8F0] shadow-xs space-y-2">
                <span className="font-mono text-xs font-bold text-[#D97706] block">01</span>
                <h3 className="text-sm font-bold text-[#09090B]">Register Property</h3>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Enter your number of floors, rooms, and default monthly rent. Your entire bed inventory is generated in 30 seconds.
                </p>
              </div>

              <div className="bg-[#F8FAFC] rounded-[10px] p-5 border border-[#E2E8F0] shadow-xs space-y-2">
                <span className="font-mono text-xs font-bold text-[#D97706] block">02</span>
                <h3 className="text-sm font-bold text-[#09090B]">Assign Residents</h3>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Add tenant names and WhatsApp numbers. Each resident gets an unguessable private link to view dues and upload proofs.
                </p>
              </div>

              <div className="bg-[#F8FAFC] rounded-[10px] p-5 border border-[#E2E8F0] shadow-xs space-y-2">
                <span className="font-mono text-xs font-bold text-[#D97706] block">03</span>
                <h3 className="text-sm font-bold text-[#09090B]">Collect & Remind</h3>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Residents pay directly to your personal UPI ID. Send 1-tap reminders when dues approach and verify payments in seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* RESIDENT TOKEN LOOKUP SECTION */}
        <section id="resident-lookup" className="max-w-xl mx-auto px-5 py-20 text-center">
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 sm:p-8 shadow-sm space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-[4px]">
                Resident Portal
              </span>
              <h2 className="text-lg font-bold text-[#09090B]">
                Are you a resident staying at a PG?
              </h2>
              <p className="text-xs text-[#64748B]">
                Enter the 12-character token from your WhatsApp rent link to view your rent status or download your HRA receipt.
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-3 pt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter token (e.g. abcd1234efgh)"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="flex-1 h-10 px-3.5 rounded-[8px] border border-[#E2E8F0] text-xs font-mono text-[#09090B] placeholder:text-[#94A3B8] bg-[#F8FAFC] focus:outline-none focus:border-[#D97706]"
                />
                <Button
                  type="submit"
                  size="md"
                  variant="solid"
                  className="bg-[#D97706] hover:bg-[#B45309] text-white text-xs px-4"
                >
                  <span>Open Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </form>

            <p className="text-[11px] text-[#94A3B8]">
              Tip: You can also tap the direct link sent to you by your PG manager on WhatsApp.
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#E2E8F0] bg-white py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-[4px] bg-[#D97706] text-white flex items-center justify-center font-bold text-[10px]">
              P
            </div>
            <span className="font-bold text-[#09090B]">PGPass</span>
            <span>· Zero-cost PG management for India</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#09090B] transition-colors">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#09090B] transition-colors">
              Terms of Service
            </Link>
            <span>·</span>
            <Link href="/login" className="hover:text-[#09090B] transition-colors">
              Owner Sign In
            </Link>
            <span>·</span>
            <Link href="/admin" className="hover:text-[#09090B] text-[#94A3B8] transition-colors">
              Master Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
