'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { updateRentRecord, updateBedStatus } from '@/lib/firestore';
import { RentRecord } from '@/types';
import { UploadCloud, CheckCircle2, Camera, RefreshCw } from 'lucide-react';
import { ProgressBar } from '@/components/ui/progress-bar';
import toast from 'react-hot-toast';

interface ProofUploaderProps {
  rentRecord?: RentRecord | null;
  bedId: string;
  tenantId: string;
  onSuccess: (url: string) => void;
}

export function ProofUploader({
  rentRecord,
  bedId,
  tenantId,
  onSuccess,
}: ProofUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    rentRecord?.proofImageUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG / JPG)');
      return;
    }

    setUploading(true);
    setProgress(30);

    try {
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
      setProgress(60);

      const uploadedUrl = await uploadToCloudinary(file, `proofs/${tenantId}`);
      setProgress(90);

      if (rentRecord?.id) {
        await updateRentRecord(rentRecord.id, {
          status: 'verify',
          proofImageUrl: uploadedUrl,
        });
      }

      await updateBedStatus(bedId, 'verify');

      setProgress(100);
      toast.success('Screenshot submitted for landlord review');
      onSuccess(uploadedUrl);
    } catch (err: any) {
      console.error(err);
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
          <span>Upload Payment Proof</span>
        </h3>
        <p className="text-xs text-[#64748B] mt-0.5">
          Attach a screenshot of your GPay, PhonePe, or bank transfer for verification.
        </p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {previewUrl ? (
        <div className="space-y-3">
          <div className="relative rounded-[8px] overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] max-h-52 flex items-center justify-center p-2">
            <img
              src={previewUrl}
              alt="Payment Proof"
              className="max-h-48 rounded-[6px] object-contain"
            />
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-[4px] bg-white/95 border border-[#E2E8F0] text-[10px] font-bold text-[#10B981] flex items-center gap-1 shadow-xs">
              <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
              <span>Uploaded</span>
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
            <span>Replace Screenshot</span>
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
            JPG, PNG from camera or photo library
          </span>

          {uploading && (
            <div className="mt-3 space-y-1.5">
              <ProgressBar value={progress} color="amber" height="sm" />
              <span className="text-[10px] font-semibold text-[#D97706]">
                Processing & uploading proof...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
