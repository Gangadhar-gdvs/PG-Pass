import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | PG-Pass',
  description: 'Terms of Service and Platform Usage Agreement for PG-Pass.',
};

export default function TermsPage() {
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
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#09090B] tracking-tight">Terms of Service</h1>
            <p className="text-xs text-[#64748B]">Effective date: 23 November 2026</p>
          </div>
        </div>

        <div className="space-y-6 text-sm text-[#334155] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">1. Zero-Commission Rent Model</h2>
            <p>
              PG-Pass is an inventory and record-keeping software tool. <strong>We do not act as an escrow agent, intermediary payment aggregator, or financial fiduciary.</strong> 100% of tenant rent settlements occur directly between the resident and the property owner&apos;s bank account via peer-to-peer or merchant UPI. PG-Pass charges 0% transaction commission on rent.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">2. UTR Anti-Fraud & Verification</h2>
            <p>
              Residents who claim rent payments must provide genuine 12-digit UPI UTR transaction reference numbers. Submitting duplicate, forged, or replayed reference numbers constitutes fraud and may result in immediate suspension of portal access and notification to the property management.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">3. Owner Subscription Plans</h2>
            <p>
              Property owners may subscribe to flat-fee platform tiers (Free, Growth, Pro) to manage increased bed inventories and photo storage limits. Subscriptions are billed on a flat monthly or annual basis.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">4. Acceptable Use & Account Security</h2>
            <p>
              Users agree not to upload malicious files, attempt to brute-force resident PIN codes, or bypass platform quota limits. Accounts engaged in abusive conduct are subject to termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[#09090B]">5. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of India. Any disputes arising out of the use of this service shall be subject to the exclusive jurisdiction of the competent courts in India.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
