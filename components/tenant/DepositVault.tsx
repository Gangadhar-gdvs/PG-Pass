'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { saveMoveinPhotos, getMoveinPhotos } from '@/lib/firestore';
import { MoveInPhoto } from '@/types';
import {
  ShieldCheck,
  Camera,
  ImagePlus,
  Share2,
  Calendar,
  Lock,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { getWhatsAppLink } from '@/lib/utils';
import { config } from '@/lib/config';

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
  const [fetching, setFetching] = useState(true);
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
      } finally {
        setFetching(false);
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

      toast.success(`${uploadedUrls.length} room condition photo(s) secured! 🛡️`);
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
            Security Deposit Protection
          </span>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Move-In Room Condition Vault</span>
          </h3>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-slate-500 block">Protected Deposit</span>
          <span className="text-sm font-black text-white">₹{depositAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Photograph wall stains, existing furniture damage, or tiles on your move-in day. Photos are permanently
        timestamped to safeguard your full deposit upon checkout.
      </p>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUploadPhoto}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Photos Grid */}
      {photos.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-black/50 group block"
              >
                <img src={url} alt={`Condition Photo ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </a>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              loading={loading}
              className="flex-1 text-xs py-2.5"
            >
              <Camera className="w-3.5 h-3.5 mr-1.5" />
              <span>Add Photos</span>
            </Button>

            {ownerPhone && (
              <Button
                variant="default"
                onClick={handleShareVault}
                className="flex-1 text-xs py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Share with Owner</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border border-slate-800 bg-slate-950/60 hover:bg-slate-950 rounded-2xl p-5 text-center transition-all cursor-pointer"
        >
          <Camera className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
          <span className="text-xs font-bold text-slate-200 block">Snap Room Condition Photos</span>
          <span className="text-[11px] text-slate-500">Tap to upload photos of walls, bathroom, furniture</span>

          {loading && (
            <div className="mt-2 text-xs text-indigo-400 animate-pulse">Securing photos...</div>
          )}
        </div>
      )}
    </div>
  );
}
