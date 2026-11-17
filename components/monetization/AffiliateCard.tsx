'use client';

import React from 'react';
import { ExternalLink, Tag, Sparkles, CreditCard, Truck, Receipt } from 'lucide-react';

interface AffiliateCardProps {
  context?: 'movein' | 'hra' | 'general' | 'checkout';
}

export function AffiliateCard({ context = 'general' }: AffiliateCardProps) {
  if (context === 'hra') {
    return (
      <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/20 rounded-2xl p-4 text-left shadow-lg">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Partner Offer • Save Taxes
          </span>
          <span className="text-[10px] text-slate-500">Sponsored</span>
        </div>
        <h4 className="text-xs font-bold text-white mb-0.5">Claim Maximum HRA Exemption on ITR</h4>
        <p className="text-[11px] text-slate-400 mb-2.5">
          E-file your salary income tax return in under 7 minutes with pre-filled rent slips.
        </p>
        <a
          href="https://cleartax.in"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-indigo-200"
        >
          <span>File with ClearTax</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  if (context === 'checkout') {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Truck className="w-3 h-3" />
            Moving Soon?
          </span>
          <span className="text-[10px] text-slate-500">Partner</span>
        </div>
        <h4 className="text-xs font-bold text-white mb-0.5">Need Mini-Truck or Packers & Movers?</h4>
        <p className="text-[11px] text-slate-400 mb-2.5">
          Book on-demand luggage shifting for Bangalore, Hyderabad, Pune & Delhi NCR.
        </p>
        <a
          href="https://porter.in"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200"
        >
          <span>Book on Porter</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-left">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
          <CreditCard className="w-3 h-3" />
          Rewards Tip
        </span>
        <span className="text-[10px] text-slate-500">Partner</span>
      </div>
      <h4 className="text-xs font-bold text-white mb-0.5">Earn 1.5% Cashback on Rent Payments</h4>
      <p className="text-[11px] text-slate-400 mb-2.5">
        Pay through reward-enabled credit cards and earn miles & cashback on every month's rent.
      </p>
      <span className="text-[11px] font-semibold text-emerald-400">
        Check Eligible Cards →
      </span>
    </div>
  );
}
