import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { Illustration } from '@/components/brand/Illustration';
import { ArrowLeft, Shield } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | PG-Pass',
  description: 'Digital Personal Data Protection & Privacy Notice for PG-Pass platform.',
};

export default function PrivacyPage() {
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
              <Shield className="h-4 w-4" /> Legal
            </span>
            <h1 className="mt-3 text-[30px] sm:text-[38px] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink">
              Privacy <span className="text-gradient">Policy</span>
            </h1>
            <p className="mt-2 text-[13px] sm:text-sm font-medium text-muted">Last updated: 23 November 2026 · Compliant with DPDP Act, 2023</p>
          </div>
          <Illustration name="shield-orbit" width={180} className="hidden min-[420px]:block shrink-0" float />
        </header>

        <div className="app-card rounded-[28px] p-6 sm:p-10">

        <div className="space-y-7 text-[14.5px] text-ink-2 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">1. Overview</h2>
            <p>
              PG-Pass provides paying-guest accommodation management and zero-commission UPI rent tracking for property owners and residents. We respect your privacy and uphold strict data minimization standards.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">2. Data Minimization (No Government ID Scans)</h2>
            <p>
              We operate on strict data minimization principles. <strong>We do not collect or store Aadhaar numbers, PAN card numbers, or scans of government ID cards of tenants.</strong> We only verify that offline identification was sighted by the PG manager (e.g., recorded as &quot;Aadhaar verified offline&quot;).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">3. Information Collected & Purpose</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Residents:</strong> Name, 10-digit mobile number, move-in/out dates, bed assignment, deposit & rent transaction logs, and move-in/move-out condition photos.</li>
              <li><strong>Property Owners & Staff:</strong> Name, phone number, PG address, and bank UPI ID / Merchant QR details for direct rent settlement.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">4. Data Storage & Cross-Border Location Disclosure</h2>
            <p>
              Primary application database records are hosted in Cloud Firestore located in <strong>Mumbai, India (`asia-south1`)</strong>. Private move-in/move-out room evidence photos and encrypted database backups are stored in private, non-public object storage provided by Backblaze B2 located in <strong>EU Central (`eu-central-003`)</strong>. Photos undergo client-side EXIF/GPS coordinate stripping prior to encrypted upload.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">5. Retention & Erasure</h2>
            <p>
              Move-in/out condition photos are automatically queued for deletion 90 days following formal resident checkout. Soft-deleted resident entries are retained for an undo grace period of 7 days before permanent purge.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">6. Resident Rights & Grievance Contact</h2>
            <p>
              Under the Digital Personal Data Protection (DPDP) Act, you have the right to request access, correction, or erasure of your personal data. To exercise these rights, please contact our grievance officer at <code>privacy@pgpass.in</code>.
            </p>
          </section>
        </div>
        </div>
      </div>
    </div>
  );
}
