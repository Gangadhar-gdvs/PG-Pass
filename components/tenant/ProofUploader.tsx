'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { uploadPhotoToB2 } from '@/lib/client/uploader';
import { RentRecord } from '@/types';
import { UploadCloud, CheckCircle2, Camera, RefreshCw } from 'lucide-react';
import { ProgressBar } from '@/components/ui/progress-bar';
import toast from 'react-hot-toast';

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
    } catch (err: any) {
      console.error('Proof upload error:', err);
      toast.error(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-xs text-left">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#09090B] flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-[#D97706]" />
          <span>Upload Payment Proof (Screenshot)</span>
        </h3>
        <p className="text-xs text-[#64748B] mt-0.5">
          Attach a screenshot of your GPay, PhonePe, or bank transfer for landlord confirmation.
        </p>
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
          <div className="rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
            <div>
              <span className="text-xs font-bold text-[#065F46] block">
                Screenshot Secured
              </span>
              <span className="text-[11px] text-[#047857]">
                Your payment screenshot has been uploaded. Submit your 12-digit UTR below to complete verification.
              </span>
            </div>
          </div>

          <Button
            size="md"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            className="w-full text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Upload Different Screenshot</span>
          </Button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-[#CBD5E1] hover:border-[#D97706] bg-[#F8FAFC] hover:bg-white rounded-[10px] p-5 text-center transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-[#09090B] block">
            Take photo or select screenshot
          </span>
          <span className="text-[11px] text-[#94A3B8] mt-0.5 block">
            JPG, PNG or WebP · Auto-compressed to WebP
          </span>

          {uploading && (
            <div className="mt-3 space-y-1.5">
              <ProgressBar value={progress} color="amber" height="sm" />
              <span className="text-[10px] font-semibold text-[#D97706]">
                Encrypting & uploading to private storage... {progress}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
