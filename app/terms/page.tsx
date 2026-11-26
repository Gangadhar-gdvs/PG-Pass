import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { Illustration } from '@/components/brand/Illustration';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | PG-Pass',
  description: 'Terms of Service and Platform Usage Agreement for PG-Pass.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 pb-16" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between py-2">
          <Link href="/" aria-label="PGPass home" className="press">
            <span className="inline-flex items-center rounded-full bg-white/70 border border-white px-3.5 py-2 shadow-[0_10px_24px_-14px_rgba(70,40,160,0.45)]">
              <Logo size={32} />
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/80 border border-white px-4 text-[13px] font-bold text-ink-2 shadow-[0_8px_18px_-10px_rgba(70,40,160,0.4)] hover:text-brand-700 press"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </div>

        <header className="relative mt-6 mb-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[image:var(--grad-brand)] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[var(--shadow-brand)]">
              <FileText className="h-4 w-4" /> Legal
            </span>
            <h1 className="mt-3 text-[30px] sm:text-[38px] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink">
              Terms <span className="text-gradient">of Service</span>
            </h1>
            <p className="mt-2 text-[13px] sm:text-sm font-medium text-muted">Effective date: 23 November 2026</p>
          </div>
          <Illustration name="clipboard" width={180} className="hidden min-[420px]:block shrink-0" float />
        </header>

        <div className="app-card rounded-[28px] p-6 sm:p-10">

        <div className="space-y-7 text-[14.5px] text-ink-2 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">1. Zero-Commission Rent Model</h2>
            <p>
              PG-Pass is an inventory and record-keeping software tool. <strong>We do not act as an escrow agent, intermediary payment aggregator, or financial fiduciary.</strong> 100% of tenant rent settlements occur directly between the resident and the property owner&apos;s bank account via peer-to-peer or merchant UPI. PG-Pass charges 0% transaction commission on rent.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">2. UTR Anti-Fraud & Verification</h2>
            <p>
              Residents who claim rent payments must provide genuine 12-digit UPI UTR transaction reference numbers. Submitting duplicate, forged, or replayed reference numbers constitutes fraud and may result in immediate suspension of portal access and notification to the property management.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">3. Owner Subscription Plans</h2>
            <p>
              Property owners may subscribe to flat-fee platform tiers (Free, Growth, Pro) to manage increased bed inventories and photo storage limits. Subscriptions are billed on a flat monthly or annual basis.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">4. Acceptable Use & Account Security</h2>
            <p>
              Users agree not to upload malicious files, attempt to brute-force resident PIN codes, or bypass platform quota limits. Accounts engaged in abusive conduct are subject to termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">5. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of India. Any disputes arising out of the use of this service shall be subject to the exclusive jurisdiction of the competent courts in India.
            </p>
          </section>
        </div>
        </div>
      </div>
    </div>
  );
}
