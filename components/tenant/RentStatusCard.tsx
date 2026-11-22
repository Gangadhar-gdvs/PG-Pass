'use client';

import React, { useState } from 'react';
import { Tenant, Owner, RentRecord } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { generateHRAReceipt } from '@/lib/pdf';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  QrCode,
  Download,
  ShieldCheck,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/status-dot';
import toast from 'react-hot-toast';

interface RentStatusCardProps {
  tenant: Tenant;
  owner: Owner;
  rentRecord?: RentRecord | null;
  onProofUploaded: (url: string) => void;
}

export function RentStatusCard({
  tenant,
  owner,
  rentRecord,
}: RentStatusCardProps) {
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showPan, setShowPan] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const status = rentRecord?.status || 'pending';
  const isPaid = status === 'paid';
  const isVerify = status === 'verify';

  const amount = rentRecord?.amount || tenant.monthlyRent || owner.monthlyRent || 8500;
  const monthYear =
    rentRecord?.monthYear ||
    new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const handleCopyUpi = () => {
    if (!owner.upiId) return;
    navigator.clipboard.writeText(owner.upiId);
    setCopiedUpi(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleDownloadHra = async () => {
    setGeneratingPdf(true);
    try {
      await generateHRAReceipt({
        tenantName: tenant.name,
        ownerName: owner.name,
        ownerPan: owner.panNumber || 'XXXXX0000X',
        pgName: owner.pgName,
        pgAddress: owner.pgAddress,
        bedId: tenant.bedLabel || 'Assigned Bed',
        amount: amount,
        monthYear: monthYear,
        paidDate: rentRecord?.paidDate || new Date().toISOString().split('T')[0],
      });
      toast.success('HRA Receipt downloaded');
      if (typeof window !== 'undefined') {
        const confetti = (await import('canvas-confetti')).default;
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Could not generate PDF receipt');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const upiPayUrl = `upi://pay?pa=${encodeURIComponent(
    owner.upiId || ''
  )}&pn=${encodeURIComponent(
    owner.name || 'PG Owner'
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(
    `Rent ${monthYear} Bed ${tenant.bedLabel || ''}`
  )}`;

  const maskPan = (pan: string) => {
    if (!pan || pan.length < 5) return 'Not on file';
    return `${pan.slice(0, 4)}•••••${pan.slice(-1)}`;
  };

  return (
    <div className="space-y-4 text-left">
      {/* Primary Rent Status Ticket */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs text-left">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <span className="text-xs font-semibold text-[#64748B]">
            Billing Cycle · {monthYear}
          </span>
          <StatusDot
            status={isPaid ? 'paid' : isVerify ? 'verify' : 'pending'}
            label={isPaid ? 'Paid' : isVerify ? 'Under Review' : 'Payment Due'}
          />
        </div>

        {/* Large Amount Display */}
        <div className="py-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] block">
            {isPaid ? 'Amount Settled' : 'Total Due'}
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono-numbers text-[#09090B] tracking-tight">
              {formatCurrency(amount)}
            </span>
            {isPaid && rentRecord?.paidDate && (
              <span className="text-xs text-[#10B981] font-semibold">
                Settled {new Date(rentRecord.paidDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        {isVerify && (
          <div className="p-3 rounded-[8px] bg-[#EEF2FF] border border-[#C7D2FE] text-xs text-[#4338CA] flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-[#6366F1]" />
            <span>
              Your payment proof has been submitted and is awaiting owner confirmation. Your official HRA receipt will unlock here once approved.
            </span>
          </div>
        )}
      </div>

      {/* If Paid -> HRA Tax Receipt Box */}
      {isPaid ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-4 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#09090B]">HRA Tax Exemption Receipt</h3>
              <p className="text-[11px] text-[#64748B]">IT Act 10(13A) compliant rent certificate</p>
            </div>
          </div>

          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Landlord / Owner:</span>
              <span className="font-bold text-[#09090B]">{owner.name || 'PG Owner'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Landlord PAN:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono-numbers font-semibold text-[#09090B]">
                  {showPan ? (owner.panNumber || 'Not on file') : maskPan(owner.panNumber || '')}
                </span>
                {owner.panNumber && (
                  <button
                    type="button"
                    onClick={() => setShowPan(!showPan)}
                    className="text-[#94A3B8] hover:text-[#09090B] p-0.5 cursor-pointer"
                    aria-label="Toggle PAN"
                  >
                    {showPan ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
            {owner.pgAddress && (
              <div className="flex items-start justify-between pt-1 border-t border-[#E2E8F0]">
                <span className="text-[#64748B]">Property:</span>
                <span className="font-medium text-[#09090B] text-right max-w-[200px] truncate">
                  {owner.pgAddress}
                </span>
              </div>
            )}
          </div>

          <Button
            size="lg"
            variant="solid"
            onClick={handleDownloadHra}
            loading={generatingPdf}
            className="w-full bg-[#10B981] hover:bg-[#059669] text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            <span>Download Official HRA Receipt (PDF)</span>
          </Button>
        </div>
      ) : (
        /* If Pending/Verify -> UPI Payment Option */
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs space-y-4 text-left">
          <div>
            <h3 className="text-sm font-bold text-[#09090B]">Direct Bank Settlement via UPI</h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Zero transaction fee transfer directly to owner bank account.
            </p>
          </div>

          {owner.upiId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-semibold text-[#64748B]">
                    Landlord UPI ID
                  </span>
                  <span className="font-mono-numbers text-xs font-bold text-[#09090B] select-all">
                    {owner.upiId}
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
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                      upiPayUrl
                    )}`}
                    alt="UPI QR Code"
                    className="w-36 h-36 border border-[#E2E8F0] rounded-[6px] bg-white p-2"
                  />
                  <span className="text-xs font-bold text-[#09090B] mt-2">
                    Scan to pay {formatCurrency(amount)}
                  </span>
                  <span className="text-[11px] text-[#64748B]">{owner.upiId}</span>
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
