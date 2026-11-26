'use client';

import { useEffect, useState } from 'react';
import { compressImage } from './imageCompress';

async function readError(res: Response, fallback: string): Promise<string> {
  const e = await res.json().catch(() => ({}));
  return (e && (e.error || e.message)) || fallback;
}

/** Current owner's profile picture (short-lived URL) or null. */
export async function fetchOwnerAvatarUrl(): Promise<string | null> {
  const res = await fetch('/api/owners/avatar');
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { url?: string | null };
  return data.url ?? null;
}

/**
 * Compress (≤512px, EXIF stripped) → presigned PUT → server verification.
 * Resolves with a fresh view URL for the saved picture.
 */
export async function uploadOwnerAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  const compressed = await compressImage(file, 512, 512);

  const intentRes = await fetch('/api/owners/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'intent', contentType: compressed.blob.type, sizeBytes: compressed.sizeBytes }),
  });
  if (!intentRes.ok) throw new Error(await readError(intentRes, 'Could not start the upload'));
  const { uploadUrl, objectKey } = await intentRes.json();

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': compressed.blob.type },
    body: compressed.blob,
  });
  if (!putRes.ok) throw new Error(`Upload failed (status ${putRes.status})`);

  const confirmRes = await fetch('/api/owners/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'confirm', objectKey }),
  });
  if (!confirmRes.ok) throw new Error(await readError(confirmRes, 'Could not save your photo'));
  const { url } = await confirmRes.json();
  return url as string;
}

export async function removeOwnerAvatar(): Promise<void> {
  const res = await fetch('/api/owners/avatar', { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, 'Could not remove your photo'));
}

/** Window event so every avatar on screen (sidebar, top bar) updates at once. */
export const AVATAR_CHANGED_EVENT = 'pgpass:avatar-changed';

export function announceAvatarChange(url: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string | null>(AVATAR_CHANGED_EVENT, { detail: url }));
}

/**
 * The signed-in owner's photo URL, kept in sync with uploads/removals made
 * anywhere on the page. Pass `enabled=false` for staff (they keep initials).
 */
export function useOwnerAvatarUrl(enabled = true): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchOwnerAvatarUrl()
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => {});
    const onChanged = (e: Event) => setUrl((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener(AVATAR_CHANGED_EVENT, onChanged);
    return () => {
      active = false;
      window.removeEventListener(AVATAR_CHANGED_EVENT, onChanged);
    };
  }, [enabled]);
  return url;
}
