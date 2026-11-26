'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency, validateUtr, errorMessage } from '@/lib/utils';
import type { RentRecord } from '@/types';
import { generateNumberedReceipt } from '@/lib/client/receiptPdf';
import { generateQrDataUrl } from '@/lib/client/qrcode';
import { buildUpiPayload } from '@/lib/client/upi';
import {
  CheckCircle2,
  Clock,
  Copy,
  QrCode,
  Download,
  ShieldCheck,
  ExternalLink,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/status-dot';
import { ProofUploader } from './ProofUploader';
import toast from 'react-hot-toast';

interface RentStatusCardProps {
  tenant: {
    id: string;
    name: string;
    roomNumber?: string;
    bedLabel?: string;
    depositPaidPaise?: number;
    securityDepositPaise?: number;
  };
  pg: {
    name: string;
    address?: string;
    upiId?: string;
    upiMerchantName?: string;
    phone?: string;
  };
  rentRecord?: RentRecord;
  portalAuth: {
    token: string;
    pin: string;
  };
  onStatusChange?: (newRecord: RentRecord) => void;
}

export function RentStatusCard({
  tenant,
  pg,
  rentRecord,
  portalAuth,
  onStatusChange,
}: RentStatusCardProps) {
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // UTR Claim State
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [proofPhotoId, setProofPhotoId] = useState<string | undefined>(undefined);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const status = rentRecord?.status || 'pending';
  const isPaid = status === 'paid';
  const isVerify = status === 'verify';

  // Amount in rupees. No fabricated default — if there is no rent record we
  // don't know the amount, so we show nothing and disable payment rather than
  // invent a figure (a wrong amount here would drive a wrong UPI payment).
  const amountPaise: number | null =
    rentRecord?.amountDuePaise ?? rentRecord?.amountPaidPaise ?? null;
  const amountRupees = amountPaise != null ? Math.round(amountPaise / 100) : null;

  const period =
    rentRecord?.period ||
    rentRecord?.monthYear ||
    new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const handleCopyUpi = () => {
    if (!pg.upiId) return;
    navigator.clipboard.writeText(pg.upiId);
    setCopiedUpi(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleDownloadReceipt = async () => {
    if (!rentRecord) return;
    setGeneratingPdf(true);
    try {
      await generateNumberedReceipt({
        owner: {
          id: 'owner',
          name: pg.upiMerchantName || pg.name,
          phone: pg.phone || '',
          pgName: pg.name,
          pgAddress: pg.address || '',
          upiId: pg.upiId || '',
        },
        tenantName: tenant.name,
        record: rentRecord,
      });
      toast.success('Official numbered receipt downloaded');
      if (typeof window !== 'undefined') {
        const confetti = (await import('canvas-confetti')).default;
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
    } catch (e: unknown) {
      console.error('Receipt generation error:', e);
      toast.error('Could not generate receipt PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Build UPI deep-link URL only when we have both a UPI id AND a known amount —
  // never generate a payment request for a fabricated figure.
  const upiPayUrl =
    pg.upiId && amountPaise != null
      ? buildUpiPayload({
          upiId: pg.upiId,
          merchantName: pg.upiMerchantName || pg.name,
          amountPaise,
          transactionNote: `Rent ${period} Bed ${tenant.bedLabel || ''}`,
        })
      : '';

  useEffect(() => {
    if (showQr && upiPayUrl && !qrDataUrl) {
      generateQrDataUrl(upiPayUrl).then(setQrDataUrl);
    }
  }, [showQr, upiPayUrl, qrDataUrl]);

  // Handle UTR claim submission
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();

    // Double-submit guard: ignore re-entry while a claim is already in flight.
    if (submittingClaim) return;

    const utr = validateUtr(utrInput);
    if (!utr.valid) {
      toast.error(utr.error || 'Please enter a valid UPI Reference / UTR Number');
      return;
    }
    const cleanUtr = utr.value;

    if (!rentRecord?.id) {
      toast.error('No active rent record to claim against');
      return;
    }

    setSubmittingClaim(true);
    try {
      const res = await fetch(`/api/rent/${rentRecord.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: portalAuth.token,
          pin: portalAuth.pin,
          paymentReference: cleanUtr,
          proofPhotoId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit payment claim');
      }

      toast.success('Payment claim submitted! Awaiting PG manager confirmation.');
      setShowClaimForm(false);
      onStatusChange?.({
        ...rentRecord,
        status: 'verify',
        paymentReference: cleanUtr,
        proofPhotoId,
      });
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Submission failed'));
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <div className="space-y-4 text-left">
      {/* Primary Rent Status Ticket */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs text-left">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <span className="text-xs font-semibold text-[#64748B]">
            Billing Cycle · {period}
          </span>
          <StatusDot
            status={isPaid ? 'paid' : isVerify ? 'verify' : 'pending'}
            label={isPaid ? 'Paid' : isVerify ? 'Under Verification' : 'Payment Due'}
          />
        </div>

        {/* Large Amount Display */}
        <div className="py-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] block">
            {isPaid ? 'Amount Settled' : 'Total Due'}
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono-numbers text-[#09090B] tracking-tight">
              {amountRupees != null ? formatCurrency(amountRupees) : '—'}
            </span>
            {isPaid && rentRecord?.receiptNumber && (
              <span className="text-xs font-mono font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-[4px]">
                REC-#{String(rentRecord.receiptNumber).padStart(5, '0')}
              </span>
            )}
          </div>
        </div>

        {isVerify && (
          <div className="p-3.5 rounded-[8px] bg-[#EEF2FF] border border-[#C7D2FE] text-xs text-[#4338CA] space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Clock className="w-4 h-4 text-[#6366F1]" />
              <span>Payment Verification Pending</span>
            </div>
            <p className="text-[11px] text-[#475569]">
              Submitted UTR: <strong className="font-mono text-[#1E1B4B]">{rentRecord?.paymentReference || 'On File'}</strong>.
              Your official numbered receipt will become available here once confirmed by your PG manager.
            </p>
          </div>
        )}
      </div>

      {/* If Paid -> Numbered Receipt Box */}
      {isPaid ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-4 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#09090B]">
                Official Digital Rent Receipt
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Sequential, tamper-evident HRA & tax-deductible receipt
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Receipt Number:</span>
              <span className="font-mono font-bold text-[#09090B]">
                REC-{String(rentRecord?.receiptNumber || 0).padStart(5, '0')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Settled For:</span>
              <span className="font-semibold text-[#09090B]">{period}</span>
            </div>
            {rentRecord?.paymentReference && (
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Bank UTR:</span>
                <span className="font-mono text-[#09090B]">{rentRecord.paymentReference}</span>
              </div>
            )}
          </div>

          <Button
            size="lg"
            variant="solid"
            onClick={handleDownloadReceipt}
            loading={generatingPdf}
            className="w-full bg-[#10B981] hover:bg-[#059669] text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            <span>Download Official PDF Receipt</span>
          </Button>
        </div>
      ) : (
        /* If Pending/Overdue -> UPI Settlement & Claim Flow */
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-4 text-left">
          <div>
            <h3 className="text-sm font-bold text-[#09090B]">
              Direct Bank Settlement via UPI (0% Fee)
            </h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Instant transfer directly to your landlord without any gateway commission.
            </p>
          </div>

          {pg.upiId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-semibold text-[#64748B]">
                    Landlord UPI ID
                  </span>
                  <span className="font-mono-numbers text-xs font-bold text-[#09090B] select-all">
                    {pg.upiId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-[6px] border border-[#E2E8F0] bg-white text-[#D97706] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                >
                  {copiedUpi ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#D97706]" />
                  )}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={upiPayUrl}
                  className="flex items-center justify-center gap-1.5 h-10 rounded-[8px] bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open UPI App</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="flex items-center justify-center gap-1.5 h-10 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#09090B] text-xs font-semibold transition-colors cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>{showQr ? 'Hide QR' : 'Show QR'}</span>
                </button>
              </div>

              {showQr && (
                <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] flex flex-col items-center justify-center text-center">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- dynamic client-generated data-URL QR code; next/image can't optimize a runtime data URL
                    <img
                      src={qrDataUrl}
                      alt="UPI QR Code"
                      className="w-36 h-36 border border-[#E2E8F0] rounded-[6px] bg-white p-2"
                    />
                  ) : (
                    <div className="w-36 h-36 border border-[#E2E8F0] rounded-[6px] bg-white p-2 flex items-center justify-center text-xs text-[#64748B]">
                      Generating QR...
                    </div>
                  )}
                  <span className="text-xs font-bold text-[#09090B] mt-2">
                    Scan to pay {amountRupees != null ? formatCurrency(amountRupees) : '—'}
                  </span>
                  <span className="text-[11px] text-[#64748B]">{pg.upiId}</span>
                </div>
              )}

              {/* UTR Claim & Payment Notification Button */}
              {!isVerify && (
                <div className="pt-2 border-t border-[#E2E8F0]">
                  {!showClaimForm ? (
                    <Button
                      size="md"
                      variant="solid"
                      onClick={() => setShowClaimForm(true)}
                      className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-[#10B981]" />
                      <span>I Have Transferred Rent (Submit UTR)</span>
                    </Button>
                  ) : (
                    <form
                      onSubmit={handleSubmitClaim}
                      className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#09090B]">
                          Submit UPI Reference (UTR)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowClaimForm(false)}
                          className="text-[11px] text-[#64748B] hover:text-[#09090B]"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label htmlFor="utr-input" className="text-[11px] font-semibold text-[#64748B] block mb-1">
                          12-digit UTR / UPI Transaction ID:
                        </label>
                        <input
                          id="utr-input"
                          type="text"
                          inputMode="numeric"
                          required
                          maxLength={32}
                          placeholder="e.g. 432198765432"
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value)}
                          className="w-full h-11 px-3 rounded-[6px] border border-[#CBD5E1] bg-white text-xs font-mono text-[#09090B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#D97706]"
                        />
                        <details className="mt-1.5">
                          <summary className="text-[11px] text-[#D97706] cursor-pointer select-none">
                            Where do I find my UTR?
                          </summary>
                          <div className="mt-1.5 text-[11px] text-[#64748B] leading-relaxed space-y-1 pl-1">
                            <p>Open your UPI app (GPay / PhonePe / Paytm) → tap the payment you just made → look for <strong>UTR</strong>, <strong>UPI Ref No.</strong>, or <strong>Transaction ID</strong>. It is a 12-digit number.</p>
                            <p>Attach a screenshot below so your manager can verify faster.</p>
                          </div>
                        </details>
                      </div>

                      {/* Screenshot Uploader */}
                      <ProofUploader
                        rentRecord={rentRecord}
                        portalAuth={portalAuth}
                        onSuccess={(id) => setProofPhotoId(id)}
                      />

                      <Button
                        size="md"
                        variant="solid"
                        type="submit"
                        loading={submittingClaim}
                        className="w-full bg-[#10B981] hover:bg-[#059669] text-white text-xs"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        <span>Confirm & Submit Reference</span>
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#64748B] italic">
              Landlord UPI details are not registered. Please contact your PG manager directly.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
