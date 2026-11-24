'use client';

import { compressImage } from './imageCompress';

export interface UploadPhotoOptions {
  file: File;
  photoType: 'move_in' | 'move_out' | 'payment_proof' | 'id_proof' | 'agreement';
  tenantId?: string;
  rentRecordId?: string;
  portalAuth?: {
    token: string;
    pin: string;
  };
  onProgress?: (percent: number) => void;
}

export interface UploadResult {
  photoId: string;
  objectKey: string;
}

/**
 * Uploads a photo directly to Backblaze B2 private bucket:
 * 1. Strips EXIF & compresses client-side to WebP (~100-150KB).
 * 2. Gets presigned PUT URL from /api/uploads/intent.
 * 3. PUTs binary directly to B2 (zero proxy bandwidth).
 * 4. Verifies magic bytes & creates metadata via /api/uploads/confirm.
 */
export async function uploadPhotoToB2(
  options: UploadPhotoOptions
): Promise<UploadResult> {
  const { file, photoType, tenantId, rentRecordId, portalAuth, onProgress } =
    options;

  onProgress?.(15);

  // 1. Client-side compression
  const compressed = await compressImage(file, 1600, 1600);
  onProgress?.(35);

  // 2. Request presigned PUT URL
  const intentPayload: Record<string, any> = {
    photoType,
    contentType: compressed.blob.type,
    sizeBytes: compressed.sizeBytes,
  };
  if (tenantId) intentPayload.tenantId = tenantId;
  if (portalAuth) {
    intentPayload.token = portalAuth.token;
    intentPayload.pin = portalAuth.pin;
  }

  const intentRes = await fetch('/api/uploads/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intentPayload),
  });

  if (!intentRes.ok) {
    const errData = await intentRes.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to initialize upload');
  }

  const { uploadUrl, objectKey } = await intentRes.json();
  onProgress?.(60);

  // 3. Direct client PUT to B2
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': compressed.blob.type,
    },
    body: compressed.blob,
  });

  if (!putRes.ok) {
    throw new Error(
      `Direct upload to private storage failed (status ${putRes.status}).`
    );
  }
  onProgress?.(85);

  // 4. Confirm upload
  const confirmPayload: Record<string, any> = {
    objectKey,
    photoType,
    rentRecordId,
  };
  if (portalAuth) {
    confirmPayload.token = portalAuth.token;
    confirmPayload.pin = portalAuth.pin;
  }

  const confirmRes = await fetch('/api/uploads/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(confirmPayload),
  });

  if (!confirmRes.ok) {
    const errData = await confirmRes.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to finalize uploaded photo');
  }

  const { photo } = await confirmRes.json();
  onProgress?.(100);

  return {
    photoId: photo.id,
    objectKey: photo.objectKey,
  };
}

export interface UploadPropertyPhotoOptions {
  file: File;
  category: string;
  caption?: string;
  sharingType?: string;
  propertyId?: string;
  onProgress?: (percent: number) => void;
}

/**
 * Uploads a PUBLIC PG gallery photo to B2:
 * 1. Compress client-side to WebP.
 * 2. Presigned PUT URL from POST /api/properties/photos.
 * 3. PUT binary directly to B2 (pending buffer).
 * 4. Confirm + publish (public-read) via PUT /api/properties/photos.
 */
export async function uploadPropertyPhoto(
  options: UploadPropertyPhotoOptions
): Promise<{ photoId: string; publicUrl: string }> {
  const { file, category, caption, sharingType, propertyId, onProgress } = options;

  onProgress?.(15);
  const compressed = await compressImage(file, 1600, 1600);
  onProgress?.(35);

  const intentRes = await fetch('/api/properties/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId,
      contentType: compressed.blob.type,
      sizeBytes: compressed.sizeBytes,
    }),
  });
  if (!intentRes.ok) {
    const e = await intentRes.json().catch(() => ({}));
    throw new Error(e.error || e.message || 'Failed to initialize upload');
  }
  const { uploadUrl, objectKey } = await intentRes.json();
  onProgress?.(60);

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': compressed.blob.type },
    body: compressed.blob,
  });
  if (!putRes.ok) throw new Error(`Upload failed (status ${putRes.status}).`);
  onProgress?.(85);

  const confirmRes = await fetch('/api/properties/photos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, objectKey, category, caption, sharingType }),
  });
  if (!confirmRes.ok) {
    const e = await confirmRes.json().catch(() => ({}));
    throw new Error(e.error || e.message || 'Failed to publish photo');
  }
  const { photo } = await confirmRes.json();
  onProgress?.(100);
  return { photoId: photo.id, publicUrl: photo.publicUrl };
}

/**
 * Fetches short-lived presigned GET URL to view private photos securely.
 */
export async function getPhotoViewUrl(
  photoId: string,
  portalAuth?: { token: string; pin: string }
): Promise<string> {
  const query = portalAuth
    ? `?token=${encodeURIComponent(portalAuth.token)}&pin=${encodeURIComponent(
        portalAuth.pin
      )}`
    : '';

  const res = await fetch(`/api/photos/${photoId}/url${query}`);
  if (!res.ok) {
    throw new Error('Could not load photo URL');
  }
  const data = await res.json();
  return data.presignedUrl;
}
