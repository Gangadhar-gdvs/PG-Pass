'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { uploadPhotoToB2 } from '@/lib/client/uploader';
import { ShieldCheck, Plus, Share2 } from 'lucide-react';
import { formatCurrency, getWhatsAppLink, errorMessage } from '@/lib/utils';
import { config } from '@/lib/config';
import toast from 'react-hot-toast';

interface DepositVaultProps {
  tenantId: string;
  depositAmount: number;
  ownerPhone?: string;
  tenantName?: string;
  token?: string;
  portalAuth?: {
    token: string;
    pin: string;
  };
}

export function DepositVault({
  tenantId,
  depositAmount,
  ownerPhone,
  tenantName,
  token,
  portalAuth,
}: DepositVaultProps) {
  const [photosCount, setPhotosCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleShareVault = () => {
    if (!ownerPhone) {
      toast.error('Owner WhatsApp number not available');
      return;
    }
    const baseUrl =
      typeof window !== 'undefined' ? window.location.origin : config.app.url;
    const portalUrl = token ? `${baseUrl}/t/${token}` : baseUrl;
    const msg = `Namaste ji 🙏,\n\nThis is ${
      tenantName || 'Resident'
    }. I have documented my Day-1 move-in room condition inspection photos in the PGPass vault:\n\n📷 ${portalUrl}\n\nSecurity Deposit: ₹${depositAmount.toLocaleString(
      'en-IN'
    )}\nThank you!`;
    const link = getWhatsAppLink(ownerPhone, msg);
    window.open(link, '_blank');
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    let successful = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadPhotoToB2({
          file,
          photoType: 'move_in',
          tenantId,
          portalAuth,
        });
        successful++;
      }

      setPhotosCount((prev) => prev + successful);
      toast.success(
        `${successful} move-in inspection photo(s) secured in private vault`
      );
    } catch (err: unknown) {
      console.error('Vault photo upload failed:', err);
      toast.error(errorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs text-left space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <h3 className="text-sm font-bold text-[#09090B]">
              Move-In Condition Vault
            </h3>
          </div>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            Document pre-existing wall marks, switches, or furniture condition to ensure your full deposit refund.
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-semibold text-[#94A3B8] block">
            Deposit
          </span>
          <span className="text-sm font-bold font-mono-numbers text-[#09090B]">
            {formatCurrency(depositAmount)}
          </span>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadPhoto}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Upload button area */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex-1 py-3 px-4 rounded-[8px] border border-dashed border-[#CBD5E1] hover:border-[#D97706] bg-[#F8FAFC] hover:bg-white flex items-center justify-center gap-2 transition-colors text-xs font-semibold text-[#64748B] hover:text-[#D97706] cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>{loading ? 'Securing photo in B2 vault...' : 'Add Move-In Condition Photo'}</span>
        </button>
      </div>

      {photosCount > 0 && (
        <div className="text-xs text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] p-2.5 rounded-[6px] flex items-center justify-between">
          <span>{photosCount} photo(s) added during this session.</span>
        </div>
      )}

      {ownerPhone && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleShareVault}
          className="w-full text-xs"
        >
          <Share2 className="w-3.5 h-3.5 mr-1.5 text-[#10B981]" />
          <span>Share Timestamped Vault via WhatsApp</span>
        </Button>
      )}
    </div>
  );
}
