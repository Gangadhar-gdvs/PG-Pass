'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { uploadPhotoToB2 } from '@/lib/client/uploader';
import { ShieldCheck, Plus, Share2, Loader2 } from 'lucide-react';
import { Icon3D, IconBubble, IconTile } from '@/components/brand/Icon3D';
import { KeyValue } from '@/components/ui/dashboard-kit';
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
    <section className="app-card p-4 sm:p-5 text-left space-y-4">
      <div className="flex items-start gap-3">
        <IconTile icon="wallet" tint="violet" size={48} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[15.5px] font-bold leading-snug text-ink">
              Move-In Condition Vault
            </h3>
            <ShieldCheck className="w-4 h-4 shrink-0 text-success" />
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            Document pre-existing wall marks, switches, or furniture condition to ensure your full deposit refund.
          </p>
        </div>
      </div>

      <div className="well px-3.5">
        <KeyValue label="Deposit" value={formatCurrency(depositAmount)} />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadPhoto}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Upload drop zone */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="group flex w-full flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-brand-200 bg-brand-50/70 px-4 py-5 text-center transition-colors hover:border-brand-300 hover:bg-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 press"
      >
        <IconBubble
          icon={
            loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            ) : (
              <Plus className="h-6 w-6 text-brand" strokeWidth={2.4} />
            )
          }
          tint="violet"
          size={52}
          className="transition-transform group-hover:scale-105"
        />
        <span className="text-[13.5px] font-bold text-ink">
          {loading ? 'Securing photo in B2 vault...' : 'Add Move-In Condition Photo'}
        </span>
      </button>

      {photosCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-success-line bg-success-bg px-3.5 py-2.5 animate-pop">
          <Icon3D name="check" size={26} />
          <span className="text-[13px] font-semibold text-success-ink">
            {photosCount} photo(s) added during this session.
          </span>
        </div>
      )}

      {ownerPhone && (
        <Button
          size="full"
          variant="outline"
          onClick={handleShareVault}
          className="!h-auto min-h-12 py-3 !whitespace-normal text-center leading-tight"
        >
          <Share2 className="w-4 h-4 shrink-0 text-success" />
          <span>Share Timestamped Vault via WhatsApp</span>
        </Button>
      )}
    </section>
  );
}
