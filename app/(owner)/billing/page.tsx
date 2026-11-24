'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useBeds } from '@/hooks/useBeds';
import { PLAN_LIMITS } from '@/lib/constants/limits';
import { PLAN_TIER, PlanTier } from '@/lib/constants/status';
import { formatCurrency } from '@/lib/utils';
import { generateQrDataUrl } from '@/lib/client/qrcode';
import { buildUpiPayload } from '@/lib/client/upi';
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Clock,
  Sparkles,
  Users,
  Layers,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { OwnerOnlyGuard } from '@/components/owner/OwnerOnlyGuard';
import toast from 'react-hot-toast';

const ADMIN_BILLING_UPI = 'pgpass.billing@icici';

function BillingPageInner() {
  const { ownerId } = useOwnerSession();
  const { beds } = useBeds(ownerId);

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Upgrade Modal State
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [utrInput, setUtrInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/owners');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (e) {
        console.error('Error fetching owner profile:', e);
      } finally {
        setLoading(false);
      }
    }
    if (ownerId) load();
  }, [ownerId]);

  const currentTier: PlanTier = (profile?.planTier as PlanTier) || PLAN_TIER.FREE;
  const currentLimits = PLAN_LIMITS[currentTier] || PLAN_LIMITS.free;

  const totalBedsCount = beds.length;
  const occupiedBedsCount = beds.filter((b) => b.status !== 'vacant').length;
  const bedUsagePercent = Math.min(
    Math.round((totalBedsCount / currentLimits.maxBeds) * 100),
    100
  );

  // Price calculations in rupees
  const getPlanPriceRupees = (tier: PlanTier, cycle: 'monthly' | 'yearly') => {
    if (tier === PLAN_TIER.GROWTH) {
      return cycle === 'monthly' ? 999 : 9990; // 2 months free on yearly
    }
    if (tier === PLAN_TIER.PRO) {
      return cycle === 'monthly' ? 1999 : 19990;
    }
    return 0;
  };

  const selectedAmountRupees = selectedPlan
    ? getPlanPriceRupees(selectedPlan, billingCycle)
    : 0;

  useEffect(() => {
    if (selectedPlan && selectedAmountRupees > 0) {
      const upiLink = buildUpiPayload({
        upiId: ADMIN_BILLING_UPI,
        merchantName: 'PGPass Platform SaaS',
        amountPaise: selectedAmountRupees * 100,
        transactionNote: `SaaS ${selectedPlan.toUpperCase()} Plan PG ${profile?.pgName || ownerId.slice(0, 6)}`,
      });
      generateQrDataUrl(upiLink).then(setQrDataUrl);
    }
  }, [selectedPlan, billingCycle, selectedAmountRupees, profile, ownerId]);

  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || selectedPlan === PLAN_TIER.FREE) return;

    const cleanUtr = utrInput.trim().toUpperCase();
    if (cleanUtr.length < 6) {
      toast.error('Please enter a valid 12-digit UPI UTR reference number');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedPlan: selectedPlan,
          billingCycle,
          amountPaise: selectedAmountRupees * 100,
          utrReference: cleanUtr,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Upgrade submission failed');
      }

      toast.success('Upgrade request submitted! Admin will activate your tier shortly.');
      setSelectedPlan(null);
      setUtrInput('');
    } catch (err: any) {
      toast.error(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8 text-left">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-xl font-bold text-[#09090B] tracking-tight">
            Subscription & Platform Quotas
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Flat, zero-commission SaaS pricing. Never pay a percentage of your rent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#64748B]">Active Tier:</span>
          <span className="text-xs uppercase font-extrabold px-3 py-1 rounded-[6px] bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
            {currentTier} Plan
          </span>
        </div>
      </div>

      {/* Resource Quota Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Bed Quota Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <Layers className="w-4 h-4 text-[#D97706]" />
              <span>Bed Inventory</span>
            </span>
            <span className="font-bold text-[#09090B] font-mono-numbers">
              {totalBedsCount} / {currentLimits.maxBeds}
            </span>
          </div>
          <ProgressBar
            value={bedUsagePercent}
            color={bedUsagePercent > 85 ? 'amber' : 'emerald'}
            height="sm"
          />
          <span className="text-[11px] text-[#94A3B8] block">
            {currentLimits.maxBeds - totalBedsCount > 0
              ? `${currentLimits.maxBeds - totalBedsCount} slots available`
              : 'Bed quota limit reached'}
          </span>
        </div>

        {/* Staff Allocation */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <Users className="w-4 h-4 text-[#10B981]" />
              <span>Staff / Wardens</span>
            </span>
            <span className="font-bold text-[#09090B] font-mono-numbers">
              {currentLimits.maxStaff} allowed
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            {currentLimits.maxStaff === 0
              ? 'Upgrade to Growth or Pro to delegate warden check-ins.'
              : `Manage up to ${currentLimits.maxStaff} staff assistants with scoped access.`}
          </p>
        </div>

        {/* Photo Vault */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <Camera className="w-4 h-4 text-[#6366F1]" />
              <span>Backblaze B2 Vault</span>
            </span>
            <span className="font-bold text-[#09090B] font-mono-numbers">
              Up to {currentLimits.maxPhotos} photos
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Encrypted private condition photos and payment screenshot archives.
          </p>
        </div>
      </div>

      {/* Tier Comparison & Upgrade Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* FREE TIER */}
        <div
          className={`bg-white rounded-[12px] p-6 border ${
            currentTier === PLAN_TIER.FREE
              ? 'border-[#D97706] ring-1 ring-[#D97706]'
              : 'border-[#E2E8F0]'
          } shadow-xs flex flex-col justify-between`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#09090B]">Free Tier</h3>
              {currentTier === PLAN_TIER.FREE && (
                <span className="text-[10px] font-bold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-[4px]">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-[#09090B]">₹0</span>
              <span className="text-xs text-[#64748B]">/ forever</span>
            </div>
            <p className="text-xs text-[#64748B]">
              Perfect for single-owner small PGs starting out.
            </p>
            <ul className="text-xs text-[#475569] space-y-2 pt-2 border-t border-[#F1F5F9]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Up to 20 beds inventory</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>0% direct UPI settlement</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Sequential HRA tax receipts</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Up to 40 B2 inspection photos</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <Button
              variant="outline"
              disabled={currentTier === PLAN_TIER.FREE}
              className="w-full text-xs"
            >
              {currentTier === PLAN_TIER.FREE ? 'Current Plan' : 'Free Tier'}
            </Button>
          </div>
        </div>

        {/* GROWTH TIER */}
        <div
          className={`bg-white rounded-[12px] p-6 border ${
            currentTier === PLAN_TIER.GROWTH
              ? 'border-[#D97706] ring-1 ring-[#D97706]'
              : 'border-[#E2E8F0]'
          } shadow-xs flex flex-col justify-between relative`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#09090B]">Growth</h3>
              {currentTier === PLAN_TIER.GROWTH ? (
                <span className="text-[10px] font-bold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-[4px]">
                  Active
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-[4px]">
                  Most Popular
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-[#09090B]">₹999</span>
              <span className="text-xs text-[#64748B]">/ month</span>
            </div>
            <p className="text-xs text-[#64748B]">
              For mid-size PGs managing up to 100 residents.
            </p>
            <ul className="text-xs text-[#475569] space-y-2 pt-2 border-t border-[#F1F5F9]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Up to 100 beds inventory</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>1 Warden / Staff delegation seat</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Up to 500 B2 encrypted photos</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Priority WhatsApp reminder queues</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <Button
              variant={currentTier === PLAN_TIER.GROWTH ? 'outline' : 'solid'}
              disabled={currentTier === PLAN_TIER.GROWTH}
              onClick={() => setSelectedPlan(PLAN_TIER.GROWTH)}
              className="w-full text-xs bg-[#D97706] hover:bg-[#B45309] text-white"
            >
              {currentTier === PLAN_TIER.GROWTH ? 'Current Plan' : 'Upgrade to Growth'}
            </Button>
          </div>
        </div>

        {/* PRO TIER */}
        <div
          className={`bg-white rounded-[12px] p-6 border ${
            currentTier === PLAN_TIER.PRO
              ? 'border-[#D97706] ring-1 ring-[#D97706]'
              : 'border-[#E2E8F0]'
          } shadow-xs flex flex-col justify-between`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#09090B]">Pro Enterprise</h3>
              {currentTier === PLAN_TIER.PRO && (
                <span className="text-[10px] font-bold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-[4px]">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-[#09090B]">₹1,999</span>
              <span className="text-xs text-[#64748B]">/ month</span>
            </div>
            <p className="text-xs text-[#64748B]">
              For large coliving buildings with multiple wardens.
            </p>
            <ul className="text-xs text-[#475569] space-y-2 pt-2 border-t border-[#F1F5F9]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Up to 500 beds inventory</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>5 Warden delegation seats</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Up to 2,500 B2 photos archive</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>Audit logging & priority SLA</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <Button
              variant={currentTier === PLAN_TIER.PRO ? 'outline' : 'solid'}
              disabled={currentTier === PLAN_TIER.PRO}
              onClick={() => setSelectedPlan(PLAN_TIER.PRO)}
              className="w-full text-xs bg-[#0F172A] hover:bg-[#1E293B] text-white"
            >
              {currentTier === PLAN_TIER.PRO ? 'Current Plan' : 'Upgrade to Pro'}
            </Button>
          </div>
        </div>
      </div>

      {/* UPGRADE MODAL DRAWER */}
      {selectedPlan && (
        <Drawer
          isOpen={!!selectedPlan}
          onClose={() => setSelectedPlan(null)}
          title={`Upgrade to ${selectedPlan.toUpperCase()} Plan`}
          description="0% Gateway Fee settlement via Direct UPI to Platform"
          width="md"
        >
          <form onSubmit={handleUpgradeSubmit} className="space-y-4 text-left">
            {/* Billing Cycle Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#09090B]">
                Billing Cycle:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`p-3 rounded-[8px] border text-left transition-all ${
                    billingCycle === 'monthly'
                      ? 'border-[#D97706] bg-[#FEF3C7] text-[#92400E]'
                      : 'border-[#E2E8F0] bg-white text-[#475569]'
                  }`}
                >
                  <span className="text-xs font-bold block">Monthly</span>
                  <span className="text-sm font-extrabold font-mono mt-0.5 block">
                    {formatCurrency(getPlanPriceRupees(selectedPlan, 'monthly'))}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`p-3 rounded-[8px] border text-left transition-all ${
                    billingCycle === 'yearly'
                      ? 'border-[#D97706] bg-[#FEF3C7] text-[#92400E]'
                      : 'border-[#E2E8F0] bg-white text-[#475569]'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center justify-between">
                    <span>Yearly</span>
                    <span className="text-[10px] text-[#10B981] font-bold">2 Mo Free</span>
                  </span>
                  <span className="text-sm font-extrabold font-mono mt-0.5 block">
                    {formatCurrency(getPlanPriceRupees(selectedPlan, 'yearly'))}
                  </span>
                </button>
              </div>
            </div>

            {/* QR Code and Payment Details */}
            <div className="p-4 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-xs text-[#64748B]">
                Scan to pay {formatCurrency(selectedAmountRupees)} via any UPI App:
              </span>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Admin UPI QR"
                  className="w-36 h-36 border border-[#E2E8F0] rounded-[8px] bg-white p-2"
                />
              ) : (
                <div className="w-36 h-36 border border-[#E2E8F0] rounded-[8px] bg-white flex items-center justify-center text-xs text-[#94A3B8]">
                  Loading QR...
                </div>
              )}
              <span className="text-xs font-mono font-bold text-[#09090B]">
                {ADMIN_BILLING_UPI}
              </span>
            </div>

            {/* UTR Reference Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#09090B]">
                Enter 12-digit UPI UTR Reference:
              </label>
              <input
                type="text"
                required
                maxLength={32}
                placeholder="e.g. 432198765432"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                className="w-full h-10 px-3 rounded-[6px] border border-[#CBD5E1] text-xs font-mono text-[#09090B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#D97706]"
              />
              <span className="text-[11px] text-[#64748B] block">
                Found in your GPay, PhonePe, or Paytm payment details.
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              variant="solid"
              loading={submitting}
              className="w-full bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold"
            >
              <span>Submit Payment for Activation</span>
            </Button>
          </form>
        </Drawer>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <OwnerOnlyGuard>
      <BillingPageInner />
    </OwnerOnlyGuard>
  );
}
