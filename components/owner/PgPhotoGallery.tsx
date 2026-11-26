'use client';

import React, { useEffect, useRef, useState } from 'react';
import { uploadPropertyPhoto } from '@/lib/client/uploader';
import { PROPERTY_PHOTO_CATEGORIES } from '@/lib/constants/storage';
import { PROPERTY_PHOTO_MAX } from '@/lib/constants/limits';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { Camera, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

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
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>('exterior');
  const [caption, setCaption] = useState('');
  const [sharingType, setSharingType] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (onResult?: (ok: boolean, photos: GalleryPhoto[]) => void) => {
    try {
      const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
      const res = await fetch(`/api/properties/photos${qs}`);
      if (res.ok) {
        const data = await res.json();
        if (onResult) onResult(true, data.photos || []);
        else setPhotos(data.photos || []);
      } else if (onResult) onResult(false, []);
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
    if (!confirm('Remove this photo from your public gallery?')) return;
    try {
      const res = await fetch(`/api/properties/photos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setPhotos((list) => list.filter((p) => p.id !== id));
      toast.success('Photo removed');
    } catch {
      toast.error('Could not remove photo');
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 sm:p-8 shadow-xs space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
        <div className="w-10 h-10 rounded-[8px] accent-soft-bg accent-text flex items-center justify-center shrink-0">
          <Camera className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#09090B]">PG Photo Gallery</h2>
          <p className="text-xs text-[#64748B]">
            Public photos shown to prospective residents. Show rooms, bathrooms, common areas, food and
            amenities — good photos attract more residents. ({photos.length}/{PROPERTY_PHOTO_MAX})
          </p>
        </div>
      </div>

      {/* Upload controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-semibold text-[#334155]">Caption (optional)</label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder='e.g. "Spacious 2-sharing AC room, 1st floor"'
            maxLength={120}
            className="w-full h-11 px-3 rounded-[8px] border-2 border-slate-200 text-sm focus:border-[color:var(--accent)] focus:outline-none"
          />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/webp,image/png" hidden onChange={onPick} />
      <Button
        variant="solid"
        size="md"
        loading={uploading}
        disabled={photos.length >= PROPERTY_PHOTO_MAX}
        onClick={() => fileRef.current?.click()}
        style={{ background: 'var(--accent)' }}
        className="text-white"
      >
        <ImagePlus className="w-4 h-4 mr-1.5" />
        {uploading ? 'Uploading…' : 'Add Photo'}
      </Button>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading gallery…
        </div>
      ) : photos.length === 0 ? (
        <p className="text-xs text-[#94A3B8] py-4 text-center">
          No photos yet. Add a few to make your PG stand out in search.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group rounded-[10px] overflow-hidden border border-[#E2E8F0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.publicUrl} alt={p.caption || p.category} className="w-full h-32 object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <span className="text-[10px] font-bold text-white uppercase tracking-wide">
                  {CATEGORY_LABELS[p.category] || p.category}
                  {p.sharingType ? ` · ${p.sharingType}-sharing` : ''}
                </span>
                {p.caption && <p className="text-[10px] text-white/90 truncate">{p.caption}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
