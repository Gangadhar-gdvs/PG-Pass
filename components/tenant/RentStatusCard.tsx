'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency, validateUtr, errorMessage } from '@/lib/utils';
import { apiPost } from '@/lib/client/api';
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
  ExternalLink,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InfoBanner, KeyValue } from '@/components/ui/dashboard-kit';
import { Icon3D, IconTile } from '@/components/brand/Icon3D';
import { ProofUploader } from './ProofUploader';
import toast from 'react-hot-toast';
import { copyText } from '@/lib/client/clipboard';

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

  const handleCopyUpi = async () => {
    if (!pg.upiId) return;
    if (!(await copyText(pg.upiId))) {
      toast.error('Could not copy — long-press or select the text to copy it manually');
      return;
    }
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
      await apiPost(`/api/rent/${rentRecord.id}/claim`, {
        token: portalAuth.token,
        pin: portalAuth.pin,
        paymentReference: cleanUtr,
        proofPhotoId,
      });

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

  const tone = isPaid ? 'success' : isVerify ? 'brand' : 'warning';
  const statusLabel = isPaid ? 'Paid' : isVerify ? 'Under Verification' : 'Payment Due';

  return (
    <div className="space-y-4 text-left">
      {/* Primary Rent Status Ticket */}
      <InfoBanner
        tone={tone}
        icon={<Icon3D name={isPaid ? 'check' : isVerify ? 'calendar-clock' : 'alert'} size={56} />}
        title={
          <>
            <span className="block text-[12.5px] font-bold opacity-75">Billing Cycle · {period}</span>
            <span className="block text-[19px] leading-tight tracking-[-0.015em]">{statusLabel}</span>
          </>
        }
        className="animate-pop"
      >
        <div className="px-4 py-3.5">
          {/* Large Amount Display */}
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-muted">
                {isPaid ? 'Amount Settled' : 'Total Due'}
              </span>
              <span className="mt-1 block text-[32px] font-extrabold font-mono-numbers leading-none tracking-[-0.03em] text-ink">
                {amountRupees != null ? formatCurrency(amountRupees) : '—'}
              </span>
            </div>
            {isPaid && rentRecord?.receiptNumber && (
              <Badge variant="paid" className="font-mono !text-[12px]">
                REC-#{String(rentRecord.receiptNumber).padStart(5, '0')}
              </Badge>
            )}
          </div>

          {isVerify && (
            <div className="mt-3 space-y-1 rounded-2xl border border-brand-200 bg-brand-50 p-3.5">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-brand-700">
                <Clock className="w-4 h-4 shrink-0 text-brand" />
                <span>Payment Verification Pending</span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                Submitted UTR: <strong className="font-mono text-ink break-all">{rentRecord?.paymentReference || 'On File'}</strong>.
                Your official numbered receipt will become available here once confirmed by your PG manager.
              </p>
            </div>
          )}
        </div>
      </InfoBanner>

      {/* If Paid -> Numbered Receipt Box */}
      {isPaid ? (
        <section className="app-card p-4 sm:p-5 space-y-4 text-left">
          <div className="flex items-start gap-3">
            <IconTile icon="doc-green" tint="mint" size={48} />
            <div className="min-w-0">
              <h3 className="text-[15.5px] font-bold leading-snug text-ink">
                Official Digital Rent Receipt
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                Sequential, tamper-evident HRA & tax-deductible receipt
              </p>
            </div>
          </div>

          <div className="well divide-y divide-line px-3.5">
            <KeyValue
              label="Receipt Number"
              value={<span className="font-mono">REC-{String(rentRecord?.receiptNumber || 0).padStart(5, '0')}</span>}
            />
            <KeyValue label="Settled For" value={period} />
            {rentRecord?.paymentReference && (
              <KeyValue
                label="Bank UTR"
                value={<span className="font-mono break-all">{rentRecord.paymentReference}</span>}
              />
            )}
          </div>

          <Button
            size="full"
            variant="solid"
            onClick={handleDownloadReceipt}
            loading={generatingPdf}
            className="!h-auto min-h-12 py-3 !whitespace-normal text-center leading-tight"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Download Official PDF Receipt</span>
          </Button>
        </section>
      ) : (
        /* If Pending/Overdue -> UPI Settlement & Claim Flow */
        <section className="app-card p-4 sm:p-5 space-y-4 text-left">
          <div className="flex items-start gap-3">
            <IconTile icon="wallet" tint="violet" size={48} />
            <div className="min-w-0">
              <h3 className="text-[15.5px] font-bold leading-snug text-ink">
                Direct Bank Settlement via UPI (0% Fee)
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                Instant transfer directly to your landlord without any gateway commission.
              </p>
            </div>
          </div>

          {pg.upiId ? (
            <div className="space-y-3">
              <div className="well flex items-center justify-between gap-3 p-3.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[12px] font-semibold text-muted">
                    Landlord UPI ID
                  </span>
                  <span className="truncate font-mono-numbers text-[14px] font-bold text-ink select-all">
                    {pg.upiId}
                  </span>
                </div>
                <Button type="button" variant="outline" size="md" onClick={handleCopyUpi} className="shrink-0 !px-4">
                  {copiedUpi ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-brand" />
                  )}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                <a href={upiPayUrl} className="btn-pill !px-4 text-[13px] cursor-pointer">
                  <ExternalLink className="w-4 h-4" />
                  <span>Open UPI App</span>
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setShowQr(!showQr)}
                  className="!px-4 !text-[13px]"
                >
                  <QrCode className="w-4 h-4 text-brand" />
                  <span>{showQr ? 'Hide QR' : 'Show QR'}</span>
                </Button>
              </div>

              {showQr && (
                <div className="well flex flex-col items-center justify-center p-5 text-center animate-pop">
                  <div className="rounded-2xl border border-white bg-white p-3 shadow-[0_14px_30px_-14px_rgba(70,40,160,0.45)]">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- dynamic client-generated data-URL QR code; next/image can't optimize a runtime data URL
                      <img src={qrDataUrl} alt="UPI QR Code" className="h-44 w-44" />
                    ) : (
                      <div className="flex h-44 w-44 items-center justify-center text-xs font-medium text-muted">
                        Generating QR...
                      </div>
                    )}
                  </div>
                  <span className="mt-3 text-[14px] font-bold text-ink">
                    Scan to pay {amountRupees != null ? formatCurrency(amountRupees) : '—'}
                  </span>
                  <span className="font-mono-numbers text-[12px] text-muted">{pg.upiId}</span>
                </div>
              )}

              {/* UTR Claim & Payment Notification Button */}
              {!isVerify && (
                <div className="border-t border-line pt-3">
                  {!showClaimForm ? (
                    <Button
                      size="full"
                      variant="soft"
                      onClick={() => setShowClaimForm(true)}
                      className="!h-auto min-h-12 py-3 !whitespace-normal text-center leading-tight"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
                      <span>I Have Transferred Rent (Submit UTR)</span>
                    </Button>
                  ) : (
                    <form onSubmit={handleSubmitClaim} className="well space-y-3 p-3.5 animate-pop">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-bold text-ink">
                          Submit UPI Reference (UTR)
                        </span>
                        <Button type="button" variant="ghost" size="md" onClick={() => setShowClaimForm(false)} className="!px-3">
                          Cancel
                        </Button>
                      </div>

                      <div>
                        <Input
                          id="utr-input"
                          label="12-digit UTR / UPI Transaction ID"
                          type="text"
                          inputMode="numeric"
                          required
                          maxLength={32}
                          placeholder="e.g. 432198765432"
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value)}
                          className="font-mono"
                        />
                        <details className="mt-2">
                          <summary className="inline-flex min-h-[36px] cursor-pointer select-none items-center text-[12.5px] font-semibold text-brand-700">
                            Where do I find my UTR?
                          </summary>
                          <div className="mt-1 space-y-1 rounded-2xl bg-white/80 p-3 text-[12px] leading-relaxed text-ink-2">
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
                        size="full"
                        variant="success"
                        type="submit"
                        loading={submittingClaim}
                      >
                        <Send className="w-4 h-4" />
                        <span>Confirm & Submit Reference</span>
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : (
            <InfoBanner
              tone="info"
              title="Landlord UPI details are not registered."
              description="Please contact your PG manager directly."
            />
          )}
        </section>
      )}
    </div>
  );
}
