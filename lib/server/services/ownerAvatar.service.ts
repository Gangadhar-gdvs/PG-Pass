import 'server-only';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { storageProvider } from '../storage/provider';
import { AppError } from '../api/withErrorHandler';
import { env } from '@/lib/env';
import { STORAGE_PREFIX, ALLOWED_MIME_TYPES, type AllowedMimeType } from '@/lib/constants/storage';
import { UPLOAD_URL_TTL_SECONDS, PHOTO_URL_TTL_SECONDS } from '@/lib/constants/limits';

/** Profile pictures are small (client compresses to ≤512px WebP); cap at 1 MB. */
export const AVATAR_MAX_BYTES = 1_048_576;

/**
 * Owner profile picture — PRIVATE object storage, never a public URL.
 *
 * Flow (same shape as tenant photos): presigned PUT into `pending/{ownerId}/avatar/`
 * → confirm: size + magic-byte check → move to `avatar/{ownerId}/` → store
 * `avatarKey` on the owner doc (old picture deleted) → the client only ever sees
 * short-lived presigned GET URLs.
 */
export const ownerAvatarService = {
  async createUploadIntent(ownerId: string, contentType: string, sizeBytes: number) {
    if (!ALLOWED_MIME_TYPES.includes(contentType as AllowedMimeType)) {
      throw new AppError(400, 'Profile photo must be a WebP or JPEG image');
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new AppError(400, 'Invalid file size');
    if (sizeBytes > AVATAR_MAX_BYTES) throw new AppError(400, 'Profile photo must be under 1 MB');

    const ext = contentType === 'image/webp' ? 'webp' : 'jpg';
    const objectKey = `${STORAGE_PREFIX.PENDING}${ownerId}/avatar/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await storageProvider.mintPresignedPut(env.B2_BUCKET, objectKey, contentType, UPLOAD_URL_TTL_SECONDS);
    return { uploadUrl, objectKey, expiresSeconds: UPLOAD_URL_TTL_SECONDS };
  },

  async confirmUpload(ownerId: string, objectKey: string) {
    // The key must sit in THIS owner's pending avatar buffer (no path tricks).
    const prefix = `${STORAGE_PREFIX.PENDING}${ownerId}/avatar/`;
    const rest = objectKey.startsWith(prefix) ? objectKey.slice(prefix.length) : '';
    if (!/^[0-9a-f-]{36}\.(webp|jpg)$/.test(rest)) {
      throw new AppError(403, 'Invalid or unauthorized object key');
    }

    const bucket = env.B2_BUCKET;
    let head;
    try {
      head = await storageProvider.headObject(bucket, objectKey);
    } catch {
      throw new AppError(404, 'Uploaded file not found');
    }
    if (head.contentLength > AVATAR_MAX_BYTES) {
      await storageProvider.deleteObject(bucket, objectKey).catch(() => {});
      throw new AppError(400, 'Profile photo must be under 1 MB');
    }
    const verified = await storageProvider.streamAndVerify(bucket, objectKey).catch(() => null);
    if (!verified || !verified.magicValid) {
      await storageProvider.deleteObject(bucket, objectKey).catch(() => {});
      throw new AppError(422, 'File failed integrity check. Only valid WebP or JPEG images are accepted.');
    }

    const destKey = `${STORAGE_PREFIX.AVATAR}${ownerId}/${rest}`;
    await storageProvider.copyObject(bucket, objectKey, destKey);
    await storageProvider.deleteObject(bucket, objectKey).catch(() => {});

    const ownerRef = adminDb.collection('owners').doc(ownerId);
    const previousKey = (await ownerRef.get()).data()?.avatarKey as string | undefined;
    await ownerRef.set({ avatarKey: destKey, avatarUpdatedAt: Timestamp.now() }, { merge: true });
    if (previousKey && previousKey !== destKey) {
      await storageProvider.deleteObject(bucket, previousKey).catch(() => {});
    }

    return { url: await storageProvider.mintPresignedGet(bucket, destKey, PHOTO_URL_TTL_SECONDS) };
  },

  /** Short-lived view URL for the owner's own picture, or null if none set. */
  async getViewUrl(ownerId: string): Promise<string | null> {
    const key = (await adminDb.collection('owners').doc(ownerId).get()).data()?.avatarKey as string | undefined;
    if (!key || !key.startsWith(`${STORAGE_PREFIX.AVATAR}${ownerId}/`)) return null;
    return storageProvider.mintPresignedGet(env.B2_BUCKET, key, PHOTO_URL_TTL_SECONDS);
  },

  async remove(ownerId: string) {
    const ownerRef = adminDb.collection('owners').doc(ownerId);
    const key = (await ownerRef.get()).data()?.avatarKey as string | undefined;
    await ownerRef.set({ avatarKey: null, avatarUpdatedAt: Timestamp.now() }, { merge: true });
    if (key) await storageProvider.deleteObject(env.B2_BUCKET, key).catch(() => {});
  },
};
