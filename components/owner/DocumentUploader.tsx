'use client';

import React, { useRef, useState } from 'react';
import { uploadPhotoToB2 } from '@/lib/client/uploader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconBubble, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { Check, RefreshCw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

type DocPhotoType = 'id_proof' | 'agreement';

const PRESETS: Record<DocPhotoType, { label: string; hint: string; icon: Icon3DName; tint: Tint }> = {
  id_proof: {
    label: 'ID Proof Document',
    hint: 'Attach Aadhaar/PAN/etc. (private)',
    icon: 'doc',
    tint: 'sky',
  },
  agreement: {
    label: 'Rental Agreement',
    hint: 'Attach the signed agreement (private)',
    icon: 'doc-green',
    tint: 'mint',
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
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not upload document'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-[22px] p-3 transition-all ${
        done
          ? 'border border-white bg-white/80 shadow-[var(--shadow-tile)]'
          : 'border-2 border-dashed border-brand-200 bg-brand-50/60'
      }`}
    >
      <IconBubble icon={preset.icon} tint={preset.tint} size={44} />
      <div className="min-w-[9rem] flex-1">
        <span className="block text-[13.5px] font-bold leading-tight text-ink">{preset.label}</span>
        {done ? (
          <Badge variant="paid" className="mt-1">
            <Check className="h-3 w-3" strokeWidth={3} />
            Uploaded · stored privately
          </Badge>
        ) : (
          <span className="mt-0.5 block text-xs font-medium leading-snug text-muted">{preset.hint}</span>
        )}
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
        variant={done ? 'outline' : 'soft'}
        loading={uploading}
        onClick={() => inputRef.current?.click()}
        className="ml-auto shrink-0"
      >
        {!uploading && (done ? <RefreshCw className="h-4 w-4" /> : <Upload className="h-4 w-4" />)}
        {done ? 'Replace' : 'Upload'}
      </Button>
    </div>
  );
}
