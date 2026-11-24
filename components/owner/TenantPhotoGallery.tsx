'use client';

import React, { useEffect, useState } from 'react';
import { getPhotoViewUrl } from '@/lib/client/uploader';
import { ImageIcon } from 'lucide-react';

interface PhotoMeta {
  id: string;
  photoType: string;
  createdAt?: any;
}

const TYPE_LABELS: Record<string, string> = {
  move_in: 'Move-in',
  move_out: 'Move-out',
  payment_proof: 'Payment',
  id_proof: 'ID Proof',
  agreement: 'Agreement',
};

function Thumb({ photo, onOpen }: { photo: PhotoMeta; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPhotoViewUrl(photo.id)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  return (
    <button
      type="button"
      onClick={() => url && onOpen(url)}
      className="relative aspect-square rounded-[8px] overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] group"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={TYPE_LABELS[photo.photoType] || 'Photo'}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-active:opacity-80"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className={`w-5 h-5 ${failed ? 'text-[#EF4444]' : 'text-[#CBD5E1] animate-pulse'}`} />
        </div>
      )}
      <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] font-semibold py-0.5 text-center">
        {TYPE_LABELS[photo.photoType] || 'Photo'}
      </span>
    </button>
  );
}

export function TenantPhotoGallery({ tenantId }: { tenantId: string }) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/photos?tenantId=${encodeURIComponent(tenantId)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPhotos(data.photos || []);
        }
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-[8px] bg-[#F1F5F9] animate-pulse" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <p className="text-[11px] text-[#94A3B8]">No photos uploaded for this resident yet.</p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p) => (
          <Thumb key={p.id} photo={p} onOpen={setPreview} />
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Photo" className="max-h-[85vh] max-w-full rounded-[8px] object-contain" />
        </div>
      )}
    </>
  );
}
