'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { updateRentRecord, updateBedStatus } from '@/lib/firestore';
import { RentRecord, Bed } from '@/types';
import { UploadCloud, CheckCircle2, Image as ImageIcon, Camera } from 'lucide-react';
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(rentRecord?.proofImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG / JPG)');
      return;
    }

    setUploading(true);
    try {
      // Create local preview instantly
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);

      // Upload to Cloudinary / storage
      const uploadedUrl = await uploadToCloudinary(file, `proofs/${tenantId}`);

      // Update Firestore record if record exists
      if (rentRecord?.id) {
        await updateRentRecord(rentRecord.id, {
          status: 'verify',
          proofImageUrl: uploadedUrl,
        });
      }

      // Update bed status to 'verify' so owner is alerted
      await updateBedStatus(bedId, 'verify');

      toast.success('Payment screenshot uploaded! Landlord notified.');
      onSuccess(uploadedUrl);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
      <div className="mb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-indigo-400" />
          <span>Upload Payment Screenshot</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Paid via GPay, PhonePe, or Paytm? Upload your transaction proof here to get verified.
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
          <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black/40 max-h-56 flex items-center justify-center">
            <img src={previewUrl} alt="Payment Proof" className="max-h-56 object-contain" />
            <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-700 text-[11px] text-slate-200 font-medium">
              Submitted
            </div>
          </div>

          <Button
            size="full"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            className="text-xs py-2.5"
          >
            <span>Replace Screenshot</span>
          </Button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-950/50 hover:bg-slate-950/80 rounded-2xl p-6 text-center transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-slate-200 block mb-0.5">
            Tap to Select or Snap Photo
          </span>
          <span className="text-[11px] text-slate-500">Supports JPG, PNG from gallery or camera</span>

          {uploading && (
            <div className="mt-3 text-xs text-indigo-400 font-semibold animate-pulse">
              Compressing & uploading...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
