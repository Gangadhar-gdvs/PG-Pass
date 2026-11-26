'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Home,
  KeyRound,
  LayoutGrid,
  Menu,
  PlayCircle,
  Plus,
  Route,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BottomTabBar } from '@/components/ui/bottom-tab-bar';
import { Logo } from '@/components/brand/Logo';
import { Icon3D, IconBubble, type Icon3DName } from '@/components/brand/Icon3D';
import { Illustration } from '@/components/brand/Illustration';
import toast from 'react-hot-toast';

/** The six pillars shown as 3D tiles (ref: "Everything You Need in One App"). */
const PILLARS: { icon: Icon3DName; title: string; desc: string }[] = [
  { icon: 'home-blue', title: 'Hostel Management', desc: 'Floors, rooms and beds — generated in seconds.' },
  { icon: 'residents', title: 'Residents Management', desc: 'Move-ins, move-outs, documents and history.' },
  { icon: 'staff', title: 'Staff Management', desc: 'Wardens with granular permissions.' },
  { icon: 'wallet', title: 'Bills & Payments', desc: 'Rent, deposits and expenses in one ledger.' },
  { icon: 'calendar-clock', title: 'Reminders & Alerts', desc: '1-tap reminders and notices for residents.' },
  { icon: 'tools', title: 'Maintenance', desc: 'Issues raised, tracked and resolved.' },
];

/** Detailed benefits (kept from the product copy). */
const FEATURES: { icon: Icon3DName; tint: 'sky' | 'peach' | 'mint' | 'violet' | 'indigo'; title: string; desc: string }[] = [
  { icon: 'bed', tint: 'sky', title: 'Visual bed inventory', desc: 'Every room and bed by floor, colour-coded: paid, due, or vacant — at a glance.' },
  { icon: 'bell', tint: 'peach', title: '1-tap WhatsApp reminders', desc: 'Send a polite pre-written rent reminder with your UPI ID and the resident’s link.' },
  { icon: 'rupee', tint: 'mint', title: 'Direct UPI, 0% fees', desc: 'Residents pay straight to your bank via UPI. No payment-gateway cut, ever.' },
  { icon: 'doc-green', tint: 'mint', title: 'Instant HRA receipts', desc: 'One-tap PDF rent certificates for residents — IT Act 10(13A) compliant.' },
  { icon: 'doc', tint: 'indigo', title: 'Move-in photo vault', desc: 'Timestamped condition photos protect deposits and settle disputes on checkout.' },
  { icon: 'check', tint: 'violet', title: 'Secure resident links', desc: 'Each resident gets a private, PIN-protected pass — no app download needed.' },
];

const STEPS: { n: string; icon: Icon3DName; title: string; desc: string }[] = [
  { n: '1', icon: 'building', title: 'Register your PG', desc: 'Add floors, rooms and your own rent per sharing type. Beds are generated instantly.' },
  { n: '2', icon: 'users', title: 'Add residents', desc: 'Enter names and WhatsApp numbers. Each gets a private link to view dues and pay.' },
  { n: '3', icon: 'rupee', title: 'Collect & remind', desc: 'Residents pay to your UPI. Send 1-tap reminders and verify payments in seconds.' },
];

const SECTION_NAV = [
  { href: '#top', label: 'Home', icon: Home },
  { href: '#features', label: 'Features', icon: LayoutGrid },
  { href: '#how', label: 'Workflow', icon: Route },
  { href: '#resident', label: 'Residents', icon: KeyRound },
  { href: '/login', label: 'Account', icon: User },
];

export default function LandingPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

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
    <div id="top" className="min-h-screen overflow-x-hidden text-ink pb-28 md:pb-0">
      {/* ===================== TOP BAR ===================== */}
      <header
        className="sticky top-0 z-40 px-4 sm:px-6"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            href="/"
            aria-label="PGPass home"
            className="inline-flex items-center rounded-full glass-bar border border-white px-4 py-2.5 shadow-[0_12px_28px_-16px_rgba(70,40,160,0.5)] press"
          >
            <Logo size={38} />
          </Link>

          <nav className="hidden md:flex items-center gap-1 rounded-full glass-bar border border-white p-1.5 shadow-[0_12px_28px_-16px_rgba(70,40,160,0.5)]">
            {[
              { href: '#features', label: 'Features' },
              { href: '#how', label: 'How it works' },
              { href: '#resident', label: 'I’m a resident' },
            ].map((l) => (
              <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[13px] font-bold text-ink-2 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                {l.label}
              </a>
            ))}
            <Link href="/login" className="btn-pill !h-10 !px-5 !text-[13px]">
              Sign in
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="md:hidden grid h-12 w-12 place-items-center rounded-full glass-bar border border-white text-ink shadow-[0_12px_28px_-16px_rgba(70,40,160,0.5)] press"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden mx-auto mt-2 max-w-6xl app-card rounded-[24px] p-2 animate-pop">
            {[
              { href: '#features', label: 'Features', icon: 'grid' as Icon3DName },
              { href: '#how', label: 'How it works', icon: 'calendar-clock' as Icon3DName },
              { href: '#resident', label: 'I’m a resident', icon: 'home-blue' as Icon3DName },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-bold text-ink hover:bg-brand-50"
              >
                <Icon3D name={l.icon} size={28} /> {l.label}
              </a>
            ))}
            <Link href="/login" className="btn-pill mt-1 w-full">
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </header>

      <main className="px-4 sm:px-6">
        {/* ===================== HERO ===================== */}
        <section className="relative mx-auto max-w-6xl pt-6 sm:pt-10 md:pt-14">
          <div className="relative grid items-center gap-6 md:grid-cols-[1.05fr_1fr]">
            <div className="relative z-10 max-w-[60%] min-[480px]:max-w-[62%] md:max-w-none">
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-[0_8px_18px_-12px_rgba(70,40,160,0.45)]">
                <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                100% free · no app for residents
              </span>
              <h1 className="mt-2 md:mt-4 text-[34px] min-[420px]:text-[38px] sm:text-[52px] lg:text-[62px] font-extrabold leading-[1.04] tracking-[-0.035em] text-ink">
                Smart PG
                <br />
                Management,
                <br />
                <span className="swoosh text-gradient">Made Easy!</span>
              </h1>
              <p className="mt-7 max-w-md text-[13.5px] sm:text-[17px] font-medium leading-relaxed text-ink-2">
                A complete solution for PG owners and residents to manage hostels, rooms, rent, maintenance
                and more — with rent paid directly to your bank over UPI.
              </p>
              <div className="mt-6 hidden md:flex flex-wrap items-center gap-3">
                <Link href="/login" className="btn-pill !px-6">
                  <ArrowRight className="h-4.5 w-4.5" /> Get Started
                </Link>
                <a href="#how" className="btn-soft !px-5">
                  <PlayCircle className="h-5 w-5 text-brand" fill="currentColor" fillOpacity={0.15} /> How It Works
                </a>
              </div>
            </div>

            {/* Building + phone scene — overlaps on phones like the ref, own column on desktop */}
            <div className="pointer-events-none absolute -right-8 top-6 w-[58%] min-[480px]:w-[52%] md:static md:w-full md:flex md:justify-end">
              <Illustration name="hero-landing" width={540} priority float className="md:w-[92%]" />
            </div>
          </div>

          {/* Phone CTAs — full width under the hero art, side by side like the ref */}
          <div className="relative z-10 mt-5 flex items-center gap-2.5 md:hidden">
            <Link href="/login" className="btn-pill flex-1 !px-4">
              <ArrowRight className="h-4.5 w-4.5" /> Get Started
            </Link>
            <a href="#how" className="btn-soft flex-1 !px-3">
              <PlayCircle className="h-5 w-5 text-brand" fill="currentColor" fillOpacity={0.15} /> How It Works
            </a>
          </div>

          {/* Section strip (ref: Home · Features · Pricing · About · Account) */}
          <nav
            aria-label="Sections"
            className="relative z-10 mt-6 md:mt-12 app-card rounded-[26px] grid grid-cols-5 divide-x divide-line/80 px-1 py-2.5"
          >
            {SECTION_NAV.map((s, i) => {
              const Icon = s.icon;
              const first = i === 0;
              const cls = `relative flex flex-col items-center gap-1 py-1.5 text-[11.5px] sm:text-[13px] font-semibold ${first ? 'text-brand-700' : 'text-ink-2 hover:text-brand-700'}`;
              const inner = (
                <>
                  <Icon className={`h-6 w-6 ${first ? 'text-brand' : 'text-[#8E88B8]'}`} fill={first ? 'currentColor' : 'none'} fillOpacity={first ? 0.18 : 0} />
                  {s.label}
                  {first && <span className="absolute -bottom-2 h-[3px] w-10 rounded-full bg-[image:var(--grad-brand)]" />}
                </>
              );
              return s.href.startsWith('/') ? (
                <Link key={s.label} href={s.href} className={cls}>{inner}</Link>
              ) : (
                <a key={s.label} href={s.href} className={cls}>{inner}</a>
              );
            })}
          </nav>
        </section>

        {/* ===================== FEATURES ===================== */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 pt-6 sm:pt-10">
          <div className="app-card relative overflow-hidden rounded-[30px] p-5 sm:p-8 lg:p-10">
            <div className="relative flex items-start justify-between gap-3">
              <div className="relative z-10 min-w-0 max-w-[68%] sm:max-w-none">
                <span className="chip">Powerful Features</span>
                <h2 className="mt-3 text-[23px] min-[400px]:text-[25px] sm:text-[36px] font-extrabold leading-[1.12] tracking-[-0.03em] text-ink">
                  Everything You Need
                  <br />
                  in <span className="text-gradient">One App</span>
                </h2>
              </div>
              <Illustration name="shield-orbit" width={210} float className="absolute -right-3 -top-3 w-[40%] max-w-[210px] sm:static sm:w-[30%] sm:-mr-2 sm:-mt-2 shrink-0" />
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-4 stagger">
              {PILLARS.map((p) => (
                <div
                  key={p.title}
                  className="flex flex-col items-center rounded-[20px] border border-white bg-white/75 px-2 py-4 sm:py-6 text-center shadow-[var(--shadow-tile)] lift"
                >
                  <Icon3D name={p.icon} size={52} className="sm:!h-16 sm:!w-16" />
                  <h3 className="mt-2.5 text-[12.5px] sm:text-[15px] font-bold leading-tight text-ink">{p.title}</h3>
                  <p className="mt-1 hidden sm:block max-w-[220px] text-xs font-medium leading-relaxed text-muted">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== WHY CHOOSE ===================== */}
        <section className="mx-auto max-w-6xl pt-5 sm:pt-8">
          <div className="relative overflow-hidden rounded-[30px] border border-white bg-[linear-gradient(120deg,#F4EEFF_0%,#E5D7FE_100%)] p-5 sm:p-8 lg:p-10 shadow-[var(--shadow-glass)]">
            <div className="grid items-center gap-4 md:grid-cols-[1.1fr_1fr]">
              <div className="relative z-10 max-w-[62%] md:max-w-none">
                <span className="chip !bg-white/70">Why Choose PGPass?</span>
                <h2 className="mt-3 text-[24px] sm:text-[34px] font-extrabold leading-[1.12] tracking-[-0.03em] text-ink">
                  Smarter Control.
                  <br />
                  <span className="text-gradient">Greater Convenience.</span>
                </h2>
                <p className="mt-3 max-w-md text-[13.5px] sm:text-[15px] font-medium leading-relaxed text-ink-2">
                  Designed for both owners and residents to simplify PG management and stay connected always.
                </p>
              </div>
              <div className="pointer-events-none absolute -right-6 top-4 w-[46%] md:static md:w-full md:flex md:justify-end">
                <Illustration name="clipboard" width={380} float />
              </div>
            </div>

            <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3 rounded-[20px] border border-white bg-white/80 p-4 shadow-[var(--shadow-tile)] lift">
                  <IconBubble icon={f.icon} tint={f.tint} size={48} />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-ink">{f.title}</h3>
                    <p className="mt-0.5 text-[13px] font-medium leading-relaxed text-muted">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== HOW IT WORKS ===================== */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 pt-12 sm:pt-16">
          <div className="mx-auto mb-7 max-w-lg text-center">
            <span className="chip">Workflow</span>
            <h2 className="mt-3 text-[26px] sm:text-[36px] font-extrabold tracking-[-0.03em] text-ink">
              Live in under a <span className="text-gradient">minute</span>
            </h2>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 stagger">
            <div aria-hidden className="hidden md:block absolute left-[16%] right-[16%] top-[54px] border-t-2 border-dashed border-brand-200" />
            {STEPS.map((s) => (
              <div key={s.n} className="app-card relative rounded-[26px] p-5 sm:p-6 lift">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[image:var(--grad-brand)] text-lg font-extrabold text-white shadow-[var(--shadow-brand)]">
                    {s.n}
                  </span>
                  <Icon3D name={s.icon} size={44} />
                </div>
                <h3 className="mt-4 text-[17px] font-extrabold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===================== RESIDENT LOOKUP ===================== */}
        <section id="resident" className="mx-auto max-w-xl scroll-mt-24 pt-12 sm:pt-16">
          <div className="app-card relative overflow-hidden rounded-[30px] p-6 sm:p-8 text-center shadow-[var(--shadow-float)]">
            <Illustration name="shield-orbit" width={190} float className="mx-auto" />
            <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.025em] text-ink">
              Staying at a <span className="text-gradient">PG?</span>
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] font-medium leading-relaxed text-muted">
              Enter the 12-character token from your WhatsApp rent link to view your rent status or download your HRA receipt.
            </p>

            <form onSubmit={handleLookup} className="mt-5 space-y-3 text-left">
              <Input
                label="Resident portal token"
                leading={<KeyRound />}
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={16}
                placeholder="abcd1234efgh"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.trim())}
                className="font-mono tracking-[0.15em] placeholder:tracking-normal"
              />
              <Button type="submit" variant="solid" size="full" className="!h-12 text-[15px]">
                Open my portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-3 text-xs font-medium text-muted">
              Tip: you can also tap the direct link your PG manager sent on WhatsApp. Have an account?{' '}
              <Link href="/resident/login" className="font-bold text-brand-700 hover:underline">
                Resident sign-in
              </Link>
            </p>
          </div>
        </section>

        {/* ===================== CTA BAND ===================== */}
        <section className="mx-auto max-w-6xl pt-12 sm:pt-16">
          <div className="cta-gradient relative overflow-hidden rounded-[28px] px-4 py-5 sm:px-8 sm:py-7 shadow-[var(--shadow-hero)]">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
                <Illustration name="bell-cta" width={92} float className="shrink-0 w-[72px] sm:w-[92px]" />
                <div className="min-w-0">
                  <h2 className="text-[17px] sm:text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-white">
                    Ready to Transform Your PG Management?
                  </h2>
                  <p className="mt-1 text-[12.5px] sm:text-sm font-medium text-white/80">
                    Free at its core — start with your first PG today.
                  </p>
                </div>
              </div>
              <Link
                href="/login"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-ink shadow-[0_12px_24px_-12px_rgba(30,10,90,0.6)] press"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 pb-8">
        <div className="app-card flex flex-col items-center justify-between gap-4 rounded-[26px] px-5 py-5 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
            <Logo size={30} />
            <span className="text-xs font-semibold text-muted">· Your PG, Our Priority</span>
          </div>
          <div className="flex items-center gap-5 text-[13px] font-semibold text-ink-2">
            <Link href="/privacy" className="hover:text-brand-700 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-brand-700 transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-brand-700 transition-colors">Sign in</Link>
            <Link href="/admin" className="text-faint hover:text-brand-700 transition-colors">Admin</Link>
          </div>
        </div>
      </footer>

      {/* ===================== MOBILE BOTTOM NAV ===================== */}
      <BottomTabBar
        primary={[
          { href: '/', label: 'Home', icon: Home },
          { href: '/#features', label: 'Features', icon: LayoutGrid },
          { href: '/#how', label: 'Workflow', icon: Route },
          { href: '/login', label: 'Account', icon: User },
        ]}
        center={{ label: 'Get started', icon: Plus, onClick: () => router.push('/login') }}
      />
    </div>
  );
}
