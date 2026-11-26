'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { uploadPhotoToB2 } from '@/lib/client/uploader';
import { RentRecord } from '@/types';
import { Camera, RefreshCw } from 'lucide-react';
import { Icon3D, IconBubble, IconTile } from '@/components/brand/Icon3D';
import { ProgressBar } from '@/components/ui/progress-bar';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

interface ProofUploaderProps {
  rentRecord?: RentRecord | null;
  portalAuth?: {
    token: string;
    pin: string;
  };
  tenantId?: string;
  onSuccess: (photoId: string) => void;
}

export function ProofUploader({
  rentRecord,
  portalAuth,
  tenantId,
  onSuccess,
}: ProofUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG / JPG / WebP)');
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const result = await uploadPhotoToB2({
        file,
        photoType: 'payment_proof',
        tenantId,
        rentRecordId: rentRecord?.id,
        portalAuth,
        onProgress: (p) => setProgress(p),
      });

      setUploaded(true);
      toast.success('Screenshot securely uploaded to encrypted vault');
      onSuccess(result.photoId);
    } catch (err: unknown) {
      console.error('Proof upload error:', err);
      toast.error(errorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-white bg-white/85 p-4 text-left shadow-[0_10px_24px_-16px_rgba(70,40,160,0.4)]">
      <div className="mb-3.5 flex items-start gap-3">
        <IconTile icon="doc" tint="sky" size={44} />
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-bold leading-snug text-ink">
            Upload Payment Proof (Screenshot)
          </h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            Attach a screenshot of your GPay, PhonePe, or bank transfer for landlord confirmation.
          </p>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {uploaded ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-success-line bg-success-bg p-3.5">
            <Icon3D name="check" size={32} />
            <div className="min-w-0">
              <span className="block text-[13px] font-bold text-success-ink">
                Screenshot Secured
              </span>
              <span className="block text-[12px] leading-relaxed text-success-ink">
                Your payment screenshot has been uploaded. Submit your 12-digit UTR below to complete verification.
              </span>
            </div>
          </div>

          {/* type="button": this uploader renders inside the UTR claim <form>;
              without it, re-picking a screenshot also submitted the claim. */}
          <Button
            type="button"
            size="md"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 text-brand" />
            <span>Upload Different Screenshot</span>
          </Button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group cursor-pointer rounded-[22px] border-2 border-dashed border-brand-200 bg-brand-50/70 p-5 text-center transition-colors hover:border-brand-300 hover:bg-white"
        >
          <IconBubble
            icon={<Camera className="h-6 w-6 text-brand" />}
            tint="violet"
            size={52}
            className="mb-2 transition-transform group-hover:scale-105"
          />
          <span className="block text-[13.5px] font-bold text-ink">
            Take photo or select screenshot
          </span>
          <span className="mt-0.5 block text-[12px] text-muted">
            JPG, PNG or WebP · Auto-compressed to WebP
          </span>

          {uploading && (
            <div className="mt-3.5 space-y-1.5">
              <ProgressBar value={progress} color="amber" height="sm" />
              <span className="block text-[11.5px] font-semibold text-brand-700">
                Encrypting & uploading to private storage... {progress}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
