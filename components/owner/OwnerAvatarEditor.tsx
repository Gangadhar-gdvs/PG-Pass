'use client';

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { uploadOwnerAvatar, removeOwnerAvatar, announceAvatarChange } from '@/lib/client/ownerAvatar';
import { errorMessage } from '@/lib/utils';

/**
 * Owner profile photo: large avatar + Add/Change + Remove. Used in the mobile
 * profile sheet and on Settings. Announces changes so every avatar updates.
 */
export function OwnerAvatarEditor({
  name,
  url,
  title,
  subtitle,
}: {
  name: string;
  url: string | null;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [askConfirm, confirmDialogEl] = useConfirm();

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || busy) return;
    setBusy(true);
    try {
      announceAvatarChange(await uploadOwnerAvatar(file));
      toast.success('Profile photo updated');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not update your photo'));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    const ok = await askConfirm({
      title: 'Remove profile photo?',
      message: 'Your initials will be shown instead.',
      confirmLabel: 'Remove photo',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeOwnerAvatar();
      announceAvatarChange(null);
      toast.success('Profile photo removed');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Could not remove your photo'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3.5">
        <div className="relative">
          <Avatar name={name} src={url} size="xl" />
          {busy && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </span>
          )}
        </div>
        {(title || subtitle) && (
          <div className="min-w-0">
            {title && <span className="block truncate text-[15px] font-extrabold text-ink">{title}</span>}
            {subtitle && <span className="block truncate text-[13px] font-medium text-muted">{subtitle}</span>}
          </div>
        )}
      </div>
      <div className="mt-3.5 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onPick}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn-soft !h-11 flex-1 !px-4 !text-[13px] disabled:opacity-50 sm:flex-none"
        >
          <Camera className="h-4 w-4 text-brand" />
          {url ? 'Change photo' : 'Add photo'}
        </button>
        {url && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label="Remove profile photo"
            className="grid h-11 w-11 place-items-center rounded-full bg-danger-bg text-danger-ink ring-1 ring-inset ring-danger-line disabled:opacity-50 press"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {confirmDialogEl}
    </div>
  );
}
