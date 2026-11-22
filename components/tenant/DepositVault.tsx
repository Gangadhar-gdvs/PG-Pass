'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { saveMoveinPhotos, getMoveinPhotos } from '@/lib/firestore';
import {
  ShieldCheck,
  Plus,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { config } from '@/lib/config';
import toast from 'react-hot-toast';

interface DepositVaultProps {
  tenantId: string;
  ownerId: string;
  depositAmount: number;
  ownerPhone?: string;
  tenantName?: string;
  token?: string;
}

export function DepositVault({
  tenantId,
  ownerId,
  depositAmount,
  ownerPhone,
  tenantName,
  token,
}: DepositVaultProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadVault() {
      try {
        const existing = await getMoveinPhotos(tenantId);
        if (existing?.photoUrls) {
          setPhotos(existing.photoUrls);
        }
      } catch (e) {
        console.warn('Could not fetch vault photos:', e);
      }
    }
    loadVault();
  }, [tenantId]);

  const handleShareVault = () => {
    if (!ownerPhone) {
      toast.error('Owner WhatsApp number not available');
      return;
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : config.app.url;
    const portalUrl = token ? `${baseUrl}/t/${token}` : baseUrl;
    const msg = `Namaste ji 🙏,\n\nThis is ${tenantName || 'Resident'}. I have documented and uploaded my Day-1 move-in room condition photos to PGPass vault:\n\n📷 ${portalUrl}\n\nSecurity Deposit: ₹${depositAmount.toLocaleString('en-IN')}\nThank you!`;
    const link = getWhatsAppLink(ownerPhone, msg);
    window.open(link, '_blank');
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadToCloudinary(file, `vaults/${tenantId}`);
        uploadedUrls.push(url);
      }

      const updated = [...photos, ...uploadedUrls];
      setPhotos(updated);
      await saveMoveinPhotos(tenantId, ownerId, updated);

      toast.success(`${uploadedUrls.length} move-in photo(s) secured in vault`);
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed. Please try again.');
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
            <h3 className="text-sm font-bold text-[#09090B]">Move-In Condition Vault</h3>
          </div>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            Document pre-existing wall marks or fixture wear to secure your refund.
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

      {/* Photos Grid */}
      <div className="grid grid-cols-4 gap-2">
        {photos.map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square rounded-[8px] overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] block cursor-pointer"
          >
            <img
              src={url}
              alt={`Condition photo ${i + 1}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="aspect-square rounded-[8px] border border-dashed border-[#CBD5E1] hover:border-[#D97706] bg-[#F8FAFC] hover:bg-white flex flex-col items-center justify-center gap-1 transition-colors text-[#64748B] hover:text-[#D97706] cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[10px] font-semibold">{loading ? '...' : 'Add'}</span>
        </button>
      </div>

      {photos.length > 0 && ownerPhone && (
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
