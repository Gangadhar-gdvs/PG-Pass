'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building,
  ArrowRight,
  Send,
  Camera,
  FileCheck,
  ShieldCheck,
  Layers,
  Wallet,
  QrCode,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

const FEATURES = [
  {
    icon: Layers,
    tint: 'accent-soft-bg',
    title: 'Visual bed inventory',
    desc: 'Every room and bed by floor, colour-coded: paid, due, or vacant — at a glance.',
  },
  {
    icon: Send,
    tint: 'bg-[#ECFDF5] text-[#10B981]',
    title: '1-tap WhatsApp reminders',
    desc: 'Send a polite pre-written rent reminder with your UPI ID and the resident’s link.',
  },
  {
    icon: Wallet,
    tint: 'bg-[#EFF6FF] text-[#2563EB]',
    title: 'Direct UPI, 0% fees',
    desc: 'Residents pay straight to your bank via UPI. No payment-gateway cut, ever.',
  },
  {
    icon: FileCheck,
    tint: 'bg-[#EEF2FF] text-[#6366F1]',
    title: 'Instant HRA receipts',
    desc: 'One-tap PDF rent certificates for residents — IT Act 10(13A) compliant.',
  },
  {
    icon: Camera,
    tint: 'bg-[#FDF2F8] text-[#DB2777]',
    title: 'Move-in photo vault',
    desc: 'Timestamped condition photos protect deposits and settle disputes on checkout.',
  },
  {
    icon: ShieldCheck,
    tint: 'bg-[#F0FDFA] text-[#0D9488]',
    title: 'Secure resident links',
    desc: 'Each resident gets a private, PIN-protected pass — no app download needed.',
  },
];

const STEPS = [
  { n: '1', title: 'Register your PG', desc: 'Add floors, rooms and your own rent per sharing type. Beds are generated instantly.' },
  { n: '2', title: 'Add residents', desc: 'Enter names and WhatsApp numbers. Each gets a private link to view dues and pay.' },
  { n: '3', title: 'Collect & remind', desc: 'Residents pay to your UPI. Send 1-tap reminders and verify payments in seconds.' },
];

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
    <div className="min-h-screen bg-white text-[#09090B] flex flex-col font-sans selection:bg-[var(--accent-soft)] selection:text-[var(--accent-ink)] pb-24 sm:pb-0">
      {/* ===================== TOP NAV ===================== */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-[#F1F5F9]">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[10px] accent-bg text-white flex items-center justify-center shadow-sm">
              <Building className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-[15px] tracking-tight">PGPass</span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="#resident"
              className="hidden sm:inline-flex text-xs font-semibold text-[#64748B] hover:text-[#09090B] px-3 py-2 rounded-full transition-colors"
            >
              I&apos;m a resident
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-[#09090B] hover:bg-black transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ===================== HERO ===================== */}
        <section className="relative overflow-hidden">
          {/* soft gradient backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-[var(--accent-tint)] via-white to-white"
          />
          <div className="relative max-w-5xl mx-auto px-5 pt-14 pb-12 sm:pt-20 sm:pb-16 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent-ink)] shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full accent-bg animate-pulse" />
              100% free · zero app downloads for residents
            </span>

            <h1 className="mt-6 text-[32px] leading-[1.1] sm:text-[52px] sm:leading-[1.05] font-extrabold tracking-tight text-[#09090B]">
              Run your PG from
              <br className="hidden sm:block" />
              <span className="accent-text"> your phone.</span>
            </h1>

            <p className="mt-4 text-sm sm:text-lg text-[#475569] leading-relaxed max-w-xl mx-auto">
              A live bed inventory, 1-tap WhatsApp rent reminders, and instant HRA
              receipts — with rent paid directly to your bank over UPI.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full accent-bg hover:brightness-105 text-white text-sm font-bold shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--accent)_60%,transparent)] transition-all"
              >
                Open your dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#09090B] text-sm font-bold transition-colors"
              >
                See how it works
              </a>
            </div>

            {/* App-style preview card */}
            <div className="mt-12 max-w-sm mx-auto">
              <div className="rounded-[26px] border border-[#E2E8F0] bg-white p-4 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.25)] text-left">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[13px] font-bold block">Your PG Dashboard</span>
                    <span className="text-[10px] text-[#94A3B8]">Product preview · sample data</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full accent-soft-bg">
                    Live
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { l: 'Occupied', v: '18 / 24', c: 'text-[#09090B]' },
                    { l: 'Collected', v: '●●●', c: 'text-[#10B981]' },
                    { l: 'Pending', v: '●●', c: 'text-[#D97706]' },
                  ].map((m) => (
                    <div key={m.l} className="p-2.5 rounded-[14px] bg-[#F8FAFC] border border-[#F1F5F9]">
                      <span className="text-[9px] uppercase font-bold text-[#94A3B8] block">{m.l}</span>
                      <span className={`text-sm font-extrabold ${m.c}`}>{m.v}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '101-A', s: 'bg-[#10B981]', t: 'Paid' },
                    { id: '101-B', s: 'bg-[#F59E0B]', t: 'Due' },
                    { id: '101-C', s: 'bg-[#CBD5E1]', t: 'Vacant' },
                  ].map((b) => (
                    <div key={b.id} className="relative p-2.5 rounded-[14px] border border-[#F1F5F9] bg-white overflow-hidden">
                      <span className={`absolute top-0 bottom-0 left-0 w-1 ${b.s}`} />
                      <span className="font-mono text-[11px] font-bold block pl-1.5">{b.id}</span>
                      <span className="text-[9px] text-[#64748B] block pl-1.5">{b.t}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between p-2.5 rounded-[14px] bg-[#ECFDF5] border border-[#A7F3D0]">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#065F46]">
                    <Send className="w-3.5 h-3.5" /> WhatsApp reminder ready
                  </span>
                  <span className="text-[10px] font-extrabold text-[#10B981]">0% fee</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== FEATURE CARDS ===================== */}
        <section className="max-w-5xl mx-auto px-5 py-14 sm:py-20">
          <div className="text-center max-w-md mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Everything a PG owner needs
            </h2>
            <p className="text-sm text-[#64748B] mt-2">
              Built for Indian PGs — manage beds, collect rent, protect deposits.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-[22px] border border-[#F1F5F9] bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)] hover:shadow-[0_12px_30px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all"
                >
                  <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center mb-3.5 ${f.tint}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-[15px] font-bold">{f.title}</h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===================== HOW IT WORKS ===================== */}
        <section id="how" className="bg-[#0F172A] text-white py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-5">
            <div className="text-center max-w-md mx-auto mb-12">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--accent-2)]">
                Workflow
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
                Live in under a minute
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {STEPS.map((s, i) => (
                <div key={s.n} className="relative rounded-[22px] bg-white/[0.04] border border-white/10 p-6">
                  <div className="w-10 h-10 rounded-full accent-bg text-white flex items-center justify-center font-extrabold text-sm mb-4">
                    {s.n}
                  </div>
                  <h3 className="text-base font-bold">{s.title}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{s.desc}</p>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="hidden md:block absolute top-1/2 -right-3 w-5 h-5 text-white/20" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== RESIDENT LOOKUP ===================== */}
        <section id="resident" className="max-w-xl mx-auto px-5 py-16 sm:py-20">
          <div className="rounded-[26px] border border-[#E2E8F0] bg-gradient-to-b from-white to-[#F8FAFC] p-6 sm:p-8 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.18)] text-center">
            <div className="w-12 h-12 rounded-[16px] accent-soft-bg flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">Staying at a PG?</h2>
            <p className="text-xs text-[#64748B] mt-1.5 max-w-sm mx-auto leading-relaxed">
              Enter the 12-character token from your WhatsApp rent link to view your
              rent status or download your HRA receipt.
            </p>

            <form onSubmit={handleLookup} className="mt-5 space-y-2.5 text-left">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569] block text-center">
                Resident portal token
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={16}
                  placeholder="abcd1234efgh"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.trim())}
                  className="w-full h-12 pl-11 pr-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-[15px] font-mono tracking-[0.15em] text-[#09090B] placeholder:text-[#CBD5E1] placeholder:tracking-normal shadow-xs transition-all focus:outline-none focus:bg-white focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              </div>
              <Button
                type="submit"
                variant="solid"
                className="w-full h-12 rounded-2xl text-white text-sm font-bold"
              >
                Open my portal
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
            <p className="text-[11px] text-[#94A3B8] mt-3">
              Tip: you can also tap the direct link your PG manager sent on WhatsApp.
            </p>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-[#F1F5F9] bg-white py-8">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[8px] accent-bg text-white flex items-center justify-center font-extrabold text-[11px]">
              P
            </div>
            <span className="font-bold text-[#09090B]">PGPass</span>
            <span className="text-[#94A3B8]">· Zero-cost PG management</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#09090B] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#09090B] transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-[#09090B] transition-colors">Sign in</Link>
            <Link href="/admin" className="text-[#CBD5E1] hover:text-[#64748B] transition-colors">Admin</Link>
          </div>
        </div>
      </footer>

      {/* ===================== MOBILE STICKY CTA ===================== */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-white/90 backdrop-blur-xl border-t border-[#F1F5F9] px-4 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 h-12 rounded-full accent-bg text-white text-sm font-bold shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--accent)_60%,transparent)]"
        >
          Get started free
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
