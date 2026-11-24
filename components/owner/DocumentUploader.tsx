'use client';

import React, { useRef, useState } from 'react';
import { uploadPhotoToB2 } from '@/lib/client/uploader';
import { Button } from '@/components/ui/button';
import { IdCard, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

type DocPhotoType = 'id_proof' | 'agreement';

const PRESETS: Record<DocPhotoType, { label: string; hint: string; icon: React.ReactNode }> = {
  id_proof: {
    label: 'ID Proof Document',
    hint: 'Attach Aadhaar/PAN/etc. (private)',
    icon: <IdCard className="w-4 h-4 text-[#64748B] shrink-0" />,
  },
  agreement: {
    label: 'Rental Agreement',
    hint: 'Attach the signed agreement (private)',
    icon: <FileText className="w-4 h-4 text-[#64748B] shrink-0" />,
  },
};

/**
 * Owner-side capture of a tenant document (ID proof or rental agreement).
 * Uploads via the existing B2 presigned flow (session-authenticated), stored
 * privately and linked to the tenant; appears in the tenant photo/document vault.
 */
export function DocumentUploader({
  tenantId,
  photoType,
}: {
  tenantId: string;
  photoType: DocPhotoType;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const preset = PRESETS[photoType];

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    setUploading(true);
    try {
      await uploadPhotoToB2({ file, photoType, tenantId });
      toast.success(`${preset.label} saved securely`);
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        {preset.icon}
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block">
            {preset.label}
          </span>
          <span className="text-[11px] text-[#94A3B8]">
            {done ? 'Uploaded · stored privately' : preset.hint}
          </span>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <Button
        size="sm"
        variant="outline"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
        className="shrink-0"
      >
        {done ? 'Replace' : 'Upload'}
      </Button>
    </div>
  );
}
