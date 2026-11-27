'use client';

import React, { useEffect, useRef, useState } from 'react';
import { uploadPropertyPhoto } from '@/lib/client/uploader';
import { PROPERTY_PHOTO_CATEGORIES } from '@/lib/constants/storage';
import { PROPERTY_PHOTO_MAX } from '@/lib/constants/limits';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { GlyphTile, IconBubble } from '@/components/brand/Icon3D';
import { Camera, Trash2, ImagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';
import { apiGet, apiDelete } from '@/lib/client/api';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface GalleryPhoto {
  id: string;
  category: string;
  caption: string | null;
  sharingType: string | null;
  publicUrl: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  exterior: 'Building / Exterior',
  room: 'Room',
  bathroom: 'Bathroom',
  common: 'Common Area',
  food: 'Food / Mess',
  amenity: 'Amenity',
  other: 'Other',
};

/**
 * Owner-facing PG photo gallery manager. Uploads are PUBLIC (shown to
 * prospective residents in discovery), categorized, and capped per property.
 */
export function PgPhotoGallery({ propertyId }: { propertyId?: string }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [askConfirm, confirmDialogEl] = useConfirm();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>('exterior');
  const [caption, setCaption] = useState('');
  const [sharingType, setSharingType] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (onResult?: (ok: boolean, photos: GalleryPhoto[]) => void) => {
    try {
      const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
      const data = await apiGet<{ photos?: GalleryPhoto[] }>(`/api/properties/photos${qs}`);
      if (onResult) onResult(true, data.photos || []);
      else setPhotos(data.photos || []);
    } catch {
      if (onResult) onResult(false, []);
    } finally {
      setLoading(false);
    }
  };

  // Guard against out-of-order responses / unmount when propertyId changes.
  useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    let ignore = false;
    queueMicrotask(() => {
      if (ignore) return;
      load((ok, list) => {
        if (!ignore && ok) setPhotos(list);
      });
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (photos.length >= PROPERTY_PHOTO_MAX) {
      toast.error(`Gallery limit reached (${PROPERTY_PHOTO_MAX} photos).`);
      return;
    }
    setUploading(true);
    try {
      await uploadPropertyPhoto({
        file,
        category,
        caption: caption.trim() || undefined,
        sharingType: category === 'room' && sharingType ? sharingType : undefined,
        propertyId,
      });
      toast.success('Photo added to your PG gallery');
      setCaption('');
      await load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    const ok = await askConfirm({
      title: 'Remove this photo?',
      message: 'It will be removed from your public PG gallery.',
      confirmLabel: 'Remove photo',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/properties/photos/${id}`);
      setPhotos((list) => list.filter((p) => p.id !== id));
      toast.success('Photo removed');
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not remove photo'));
    }
  };

  const full = photos.length >= PROPERTY_PHOTO_MAX;

  return (
    <section className="app-card space-y-5 p-4 sm:p-6">
      <div className="flex items-start gap-3.5">
        <GlyphTile icon={Camera} tone="brand" size={48} />
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.015em] text-ink">PG Photo Gallery</h2>
          <p className="mt-0.5 text-[13px] font-medium leading-relaxed text-muted">
            Public photos shown to prospective residents. Show rooms, bathrooms, common areas, food and
            amenities — good photos attract more residents.
          </p>
        </div>
      </div>

      {/* Upload controls */}
      <div className="well space-y-3.5 p-3.5 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Dropdown
            label="Category"
            value={category}
            onChange={setCategory}
            options={PROPERTY_PHOTO_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          />
          {category === 'room' && (
            <Dropdown
              label="Sharing (optional)"
              value={sharingType}
              onChange={setSharingType}
              options={[
                { value: '', label: 'Any' },
                ...['1', '2', '3', '4', '5', '6'].map((s) => ({ value: s, label: `${s}-sharing` })),
              ]}
            />
          )}
          <div className="sm:col-span-2">
            <Input
              label="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder='e.g. "Spacious 2-sharing AC room, 1st floor"'
              maxLength={120}
            />
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/jpeg,image/webp,image/png" hidden onChange={onPick} />

        {/* Add-photo zone */}
        <div className="flex flex-col gap-4 rounded-[22px] border-2 border-dashed border-brand-200 bg-white/60 p-3.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <IconBubble icon={<ImagePlus className="h-5 w-5" />} tint="violet" size={46} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-ink">
                <span>Photos</span>
                <span className={`font-mono-numbers ${full ? 'text-warning-ink' : 'text-brand-700'}`}>
                  {photos.length}/{PROPERTY_PHOTO_MAX}
                </span>
              </div>
              <ProgressBar value={(photos.length / PROPERTY_PHOTO_MAX) * 100} height="sm" className="mt-2" />
              {full && (
                <p className="mt-1.5 text-xs font-semibold text-warning-ink">
                  Gallery limit reached ({PROPERTY_PHOTO_MAX} photos).
                </p>
              )}
            </div>
          </div>
          <Button
            variant="solid"
            size="md"
            loading={uploading}
            disabled={photos.length >= PROPERTY_PHOTO_MAX}
            onClick={() => fileRef.current?.click()}
            className="w-full sm:w-auto"
          >
            {!uploading && <ImagePlus className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Add Photo'}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="status" aria-label="Loading gallery…">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl ring-2 ring-white animate-shimmer" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <EmptyState
          icon3d="home-blue"
          title="No photos yet"
          description="Add a few to make your PG stand out in search."
          className="py-6"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 stagger">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative overflow-hidden rounded-2xl bg-lilac-2 ring-2 ring-white shadow-[var(--shadow-tile)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.publicUrl} alt={p.caption || p.category} className="h-32 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/75 via-ink/35 to-transparent px-2.5 pb-2 pt-6">
                <span className="block text-[11px] font-bold leading-tight text-white">
                  {CATEGORY_LABELS[p.category] || p.category}
                  {p.sharingType ? ` · ${p.sharingType}-sharing` : ''}
                </span>
                {p.caption && <p className="truncate text-[10.5px] font-medium text-white/85">{p.caption}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-full border border-white bg-white/90 text-danger shadow-[var(--shadow-tile)] press pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Remove photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {confirmDialogEl}
    </section>
  );
}
