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
  IndianRupee,
  ShieldCheck,
  Building2,
  FileCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const status = rentRecord?.status || 'pending';
  const isPaid = status === 'paid';
  const isVerify = status === 'verify';
  const isPending = status === 'pending';

  const amount = rentRecord?.amount || 8500;
  const monthYear = rentRecord?.monthYear || new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const handleCopyUpi = () => {
    if (!owner.upiId) return;
    navigator.clipboard.writeText(owner.upiId);
    setCopiedUpi(true);
    toast.success('UPI ID copied to clipboard!');
    setTimeout(() => setCopiedUpi(false), 2500);
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
      toast.success('HRA Receipt downloaded! 📄');
      if (typeof window !== 'undefined') {
        const confetti = (await import('canvas-confetti')).default;
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Could not generate PDF receipt');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // UPI deep link
  const upiPayUrl = `upi://pay?pa=${encodeURIComponent(owner.upiId || '')}&pn=${encodeURIComponent(
    owner.name || 'PG Owner'
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Rent ${monthYear} Bed ${tenant.bedLabel || ''}`)}`;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Top Status Gradient Strip */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${
          isPaid ? 'bg-emerald-500' : isVerify ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
        }`}
      />

      {/* Greeting Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="text-xs font-semibold text-slate-400 block mb-0.5">Welcome to your Portal</span>
          <h2 className="text-2xl font-black text-white">Hi, {tenant.name.split(' ')[0]} 👋</h2>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-indigo-400 block">{owner.pgName || 'Our PG'}</span>
          <span className="text-[11px] font-mono text-slate-400">Bed {tenant.bedLabel || 'Room'}</span>
        </div>
      </div>

      {/* Status Box */}
      <div
        className={`rounded-2xl p-4.5 border mb-5 ${
          isPaid
            ? 'bg-emerald-950/20 border-emerald-500/30'
            : isVerify
            ? 'bg-amber-950/20 border-amber-500/40'
            : 'bg-rose-950/20 border-rose-500/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isPaid
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isVerify
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {isPaid ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isVerify ? (
                <Clock className="w-5 h-5 animate-spin" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                {monthYear} Rent Status
              </span>
              <span className="text-base font-black text-white">
                {isPaid
                  ? 'Rent Paid in Full'
                  : isVerify
                  ? 'Payment Under Verification'
                  : `${formatCurrency(amount)} Due`}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xl font-black text-white">{formatCurrency(amount)}</span>
          </div>
        </div>

        {isVerify && (
          <p className="text-xs text-amber-300 mt-3 pt-3 border-t border-amber-500/20 leading-relaxed">
            Your payment screenshot is awaiting landlord approval. Once approved, your instant HRA receipt will unlock here!
          </p>
        )}
      </div>

      {/* Action Area based on status */}
      {isPaid ? (
        <div className="space-y-3">
          <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-emerald-300 block">Official HRA Tax Receipt</span>
                <span className="text-[11px] text-slate-400">Includes Owner PAN ({owner.panNumber || 'Provided'})</span>
              </div>
            </div>
          </div>

          <Button
            size="full"
            onClick={handleDownloadHra}
            loading={generatingPdf}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 shadow-emerald-900/30"
          >
            <Download className="w-4 h-4 mr-2" />
            <span>Download HRA Receipt (PDF)</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* UPI Payment Drawer */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-400" />
                Pay Directly to Landlord UPI
              </span>
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQr ? 'Hide QR' : 'Show QR'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-2.5 px-3">
              <span className="font-mono text-xs text-indigo-200 font-bold select-all truncate">
                {owner.upiId || 'suresh@okicici'}
              </span>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 ml-2 font-medium cursor-pointer"
              >
                {copiedUpi ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Quick Open UPI App on Phone */}
            <div className="mt-3 flex gap-2">
              <a
                href={upiPayUrl}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Open UPI App (GPay / PhonePe)</span>
              </a>
            </div>

            {/* Optional QR Code Drawer */}
            {showQr && (
              <div className="mt-4 p-4 bg-white rounded-2xl flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-150">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    upiPayUrl
                  )}`}
                  alt="UPI QR Code"
                  className="w-40 h-40"
                />
                <span className="text-[11px] text-slate-800 font-bold mt-2">Scan & Pay ₹{amount}</span>
                <span className="text-[10px] text-slate-500">{owner.upiId}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
