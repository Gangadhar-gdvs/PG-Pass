'use client';

import React, { useEffect, useState } from 'react';
import { getPhotoViewUrl } from '@/lib/client/uploader';
import { apiGet } from '@/lib/client/api';
import { ImageIcon, Images, X } from 'lucide-react';
import { IconBubble } from '@/components/brand/Icon3D';
import type { Timestampish } from '@/types';

interface PhotoMeta {
  id: string;
  photoType: string;
  createdAt?: Timestampish;
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
      className="group relative aspect-square overflow-hidden rounded-2xl bg-lilac-2 ring-2 ring-white shadow-[var(--shadow-tile)] press"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={TYPE_LABELS[photo.photoType] || 'Photo'}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-opacity group-active:opacity-80"
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${failed ? 'bg-danger-bg' : 'animate-shimmer'}`}>
          <ImageIcon className={`h-5 w-5 ${failed ? 'text-danger' : 'text-faint'}`} />
        </div>
      )}
      <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-white/90 px-1.5 py-0.5 text-center text-[10px] font-bold leading-tight text-ink shadow-[var(--shadow-tile)]">
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
        const data = await apiGet<{ photos?: typeof photos }>(`/api/photos?tenantId=${encodeURIComponent(tenantId)}`);
        if (!cancelled) setPhotos(data.photos || []);
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
      <div className="grid grid-cols-4 gap-2.5" role="status" aria-label="Loading photos">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl ring-2 ring-white animate-shimmer" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="well flex items-center gap-3 p-3">
        <IconBubble icon={<Images className="h-5 w-5" />} tint="slate" size={40} />
        <p className="text-[12.5px] font-medium text-muted">No photos uploaded for this resident yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-2.5 stagger">
        {photos.map((p) => (
          <Thumb key={p.id} photo={p} onOpen={setPreview} />
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm animate-fade"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-white bg-white/90 text-ink-2 shadow-[var(--shadow-float)] press"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Photo"
            className="max-h-[85vh] max-w-full rounded-[22px] object-contain ring-4 ring-white/80 shadow-[var(--shadow-float)] animate-pop"
          />
        </div>
      )}
    </>
  );
}
