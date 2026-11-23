import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, FileText, CheckCircle } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | PG-Pass',
  description: 'Digital Personal Data Protection & Privacy Notice for PG-Pass platform.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-[#E2E8F0] rounded-[14px] p-8 sm:p-12 shadow-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#09090B] mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-[8px] bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#09090B] tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-[#64748B]">Last updated: 23 November 2026 · Compliant with DPDP Act, 2023</p>
          </div>
        </div>

        <div className="space-y-6 text-sm text-[#334155] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">1. Overview</h2>
            <p>
              PG-Pass provides paying-guest accommodation management and zero-commission UPI rent tracking for property owners and residents. We respect your privacy and uphold strict data minimization standards.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">2. Data Minimization (No Government ID Scans)</h2>
            <p>
              We operate on strict data minimization principles. <strong>We do not collect or store Aadhaar numbers, PAN card numbers, or scans of government ID cards of tenants.</strong> We only verify that offline identification was sighted by the PG manager (e.g., recorded as "Aadhaar verified offline").
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">3. Information Collected & Purpose</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Residents:</strong> Name, 10-digit mobile number, move-in/out dates, bed assignment, deposit & rent transaction logs, and move-in/move-out condition photos.</li>
              <li><strong>Property Owners & Staff:</strong> Name, phone number, PG address, and bank UPI ID / Merchant QR details for direct rent settlement.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">4. Data Storage & Cross-Border Location Disclosure</h2>
            <p>
              Primary application database records are hosted in Cloud Firestore located in <strong>Mumbai, India (`asia-south1`)</strong>. Private move-in/move-out room evidence photos and encrypted database backups are stored in private, non-public object storage provided by Backblaze B2 located in <strong>EU Central (`eu-central-003`)</strong>. Photos undergo client-side EXIF/GPS coordinate stripping prior to encrypted upload.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">5. Retention & Erasure</h2>
            <p>
              Move-in/out condition photos are automatically queued for deletion 90 days following formal resident checkout. Soft-deleted resident entries are retained for an undo grace period of 7 days before permanent purge.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">6. Resident Rights & Grievance Contact</h2>
            <p>
              Under the Digital Personal Data Protection (DPDP) Act, you have the right to request access, correction, or erasure of your personal data. To exercise these rights, please contact our grievance officer at <code>privacy@pgpass.in</code>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
