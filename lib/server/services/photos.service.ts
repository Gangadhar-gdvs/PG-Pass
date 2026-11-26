import 'server-only';
import { adminDb } from '../firebase-admin';
import { storageProvider } from '../storage/provider';
import { env } from '@/lib/env';
import { AppError } from '../api/withErrorHandler';
import { PHOTO_MAX_BYTES, UPLOAD_URL_TTL_SECONDS, PHOTO_URL_TTL_SECONDS } from '@/lib/constants/limits';
import {
  STORAGE_PREFIX,
  ALLOWED_MIME_TYPES,
  AllowedMimeType,
  PROPERTY_PHOTO_CATEGORIES,
  PropertyPhotoCategory,
} from '@/lib/constants/storage';
import { PhotoType } from '@/lib/constants/status';
import { PROPERTY_PHOTO_MAX } from '@/lib/constants/limits';
import { PropertyPhoto } from '@/types';
import { tsToDate, tsToMillis } from '@/lib/utils';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

export interface CreateUploadIntentParams {
  ownerId: string;
  tenantId: string;
  photoType: PhotoType;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
}

export interface ConfirmUploadParams {
  ownerId: string;
  objectKey: string;
  photoType: PhotoType;
  rentRecordId?: string;
  uploadedBy: string;
}

export interface GetPhotoPresignedUrlParams {
  photoId: string;
  callerUid: string;
  callerRole: string;
  callerOwnerId?: string;
}

export class PhotosService {
  /**
   * Mints an S3 presigned PUT URL for client upload to Backblaze B2 (pending/ prefix).
   */
  async createUploadIntent(params: CreateUploadIntentParams) {
    const { ownerId, tenantId, contentType, sizeBytes } = params;

    // 1. Verify content type
    if (!ALLOWED_MIME_TYPES.includes(contentType as AllowedMimeType)) {
      throw new AppError(
        400,
        `Invalid image format: ${contentType}. Allowed: image/webp, image/jpeg`
      );
    }

    // 2. Verify file size cap (5 MB)
    if (sizeBytes > PHOTO_MAX_BYTES) {
      throw new AppError(
        400,
        `File size exceeds maximum allowed limit of ${PHOTO_MAX_BYTES / (1024 * 1024)} MB`
      );
    }

    // 3+4. Tenant, owner, and photo count are independent reads → run in parallel.
    const [tenantDoc, ownerDoc, photosCountSnap] = await Promise.all([
      adminDb.collection('tenants').doc(tenantId).get(),
      adminDb.collection('owners').doc(ownerId).get(),
      adminDb.collection('movein_photos').where('ownerId', '==', ownerId).count().get(),
    ]);

    if (!tenantDoc.exists) {
      throw new AppError(404, 'Tenant record not found');
    }
    const tenantData = tenantDoc.data()!;
    if (tenantData.ownerId !== ownerId) {
      throw new AppError(403, 'Unauthorized tenant access');
    }
    if (tenantData.deletedAt) {
      throw new AppError(400, 'Cannot upload photos for a deleted tenant');
    }

    if (ownerDoc.exists) {
      const maxPhotos = ownerDoc.data()!.maxPhotos ?? 40; // Default Free tier: 40 photos
      if (photosCountSnap.data().count >= maxPhotos) {
        throw new AppError(
          403,
          `Photo storage quota reached (${maxPhotos} photos). Please upgrade your subscription.`
        );
      }
    }

    // 5. Generate secure objectKey under pending/
    const uuid = crypto.randomUUID();
    const ext = contentType === 'image/webp' ? 'webp' : 'jpg';
    const objectKey = `${STORAGE_PREFIX.PENDING}${ownerId}/${tenantId}/${uuid}.${ext}`;

    const bucket = env.B2_BUCKET;
    const uploadUrl = await storageProvider.mintPresignedPut(
      bucket,
      objectKey,
      contentType,
      UPLOAD_URL_TTL_SECONDS
    );

    return {
      uploadUrl,
      objectKey,
      expiresSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  /**
   * Confirms upload: verifies magic bytes + SHA-256, moves from pending/ to final prefix,
   * and creates the movein_photos metadata document.
   */
  async confirmUpload(params: ConfirmUploadParams) {
    const { ownerId, objectKey, photoType, rentRecordId, uploadedBy } = params;

    // 1. Verify objectKey ownership pattern: pending/{ownerId}/{tenantId}/{uuid}.{ext}
    const expectedPrefix = `${STORAGE_PREFIX.PENDING}${ownerId}/`;
    if (!objectKey.startsWith(expectedPrefix)) {
      throw new AppError(403, 'Invalid or unauthorized object key');
    }

    const segments = objectKey.split('/');
    if (segments.length < 4) {
      throw new AppError(400, 'Malformed object key structure');
    }
    const tenantId = segments[2];

    const bucket = env.B2_BUCKET;

    // 2. HeadObject check on B2
    let head;
    try {
      head = await storageProvider.headObject(bucket, objectKey);
    } catch {
      throw new AppError(404, 'Uploaded file not found in storage buffer');
    }

    if (head.contentLength > PHOTO_MAX_BYTES) {
      await storageProvider.deleteObject(bucket, objectKey).catch(() => {});
      throw new AppError(400, 'File exceeds maximum allowed size');
    }

    // 3. Stream object: verify magic bytes and compute SHA-256
    let streamResult;
    try {
      streamResult = await storageProvider.streamAndVerify(bucket, objectKey);
    } catch {
      await storageProvider.deleteObject(bucket, objectKey).catch(() => {});
      throw new AppError(500, 'Failed to inspect uploaded file');
    }

    if (!streamResult.magicValid) {
      await storageProvider.deleteObject(bucket, objectKey).catch(() => {});
      throw new AppError(
        422,
        'File failed integrity check: invalid magic bytes. Only valid WebP or JPEG images are accepted.'
      );
    }

    // 4. Move from pending/ to target prefix
    let targetPrefix: string;
    if (photoType === 'move_out') {
      targetPrefix = STORAGE_PREFIX.MOVEOUT;
    } else if (photoType === 'payment_proof') {
      targetPrefix = STORAGE_PREFIX.PAYMENT_PROOF;
    } else if (photoType === 'id_proof') {
      targetPrefix = STORAGE_PREFIX.ID_PROOF;
    } else if (photoType === 'agreement') {
      targetPrefix = STORAGE_PREFIX.AGREEMENT;
    } else {
      targetPrefix = STORAGE_PREFIX.MOVEIN;
    }

    const destKey = objectKey.replace(STORAGE_PREFIX.PENDING, targetPrefix);

    try {
      await storageProvider.copyObject(bucket, objectKey, destKey);
      await storageProvider.deleteObject(bucket, objectKey);
    } catch {
      throw new AppError(500, 'Failed to finalize storage object placement');
    }

    // 5. Create movein_photos metadata document
    const photoDocRef = adminDb.collection('movein_photos').doc();
    const photoDoc = {
      id: photoDocRef.id,
      ownerId,
      propertyId: ownerId, // primary property; threaded per-property in a later phase
      tenantId,
      rentRecordId: rentRecordId || null,
      photoType,
      storageProvider: 'b2',
      objectKey: destKey,
      contentType: streamResult.contentType || head.contentType || 'image/webp',
      sizeBytes: streamResult.contentLength,
      sha256: streamResult.sha256,
      uploadedBy,
      createdAt: Timestamp.now(),
    };

    await photoDocRef.set(photoDoc);

    return photoDoc;
  }

  /**
   * Lists a tenant's photo metadata (not the bytes) for the owner gallery.
   * Owner-scoped: the caller's ownerId must match the photo's ownerId.
   */
  async listTenantPhotos(ownerId: string, tenantId: string, limitCount = 50) {
    const snap = await adminDb
      .collection('movein_photos')
      .where('ownerId', '==', ownerId)
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limitCount, 100))
      .get();

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        photoType: data.photoType,
        rentRecordId: data.rentRecordId || null,
        createdAt: data.createdAt || null,
      };
    });
  }

  /**
   * Mints short-lived presigned GET URL for viewing private photos.
   */
  async getPhotoPresignedUrl(params: GetPhotoPresignedUrlParams) {
    const { photoId, callerUid, callerRole, callerOwnerId } = params;

    const photoDoc = await adminDb.collection('movein_photos').doc(photoId).get();
    if (!photoDoc.exists) {
      throw new AppError(404, 'Photo record not found');
    }

    const photo = photoDoc.data()!;

    // Authorization check
    if (callerRole === 'admin') {
      // Audit log mandatory for admin viewing user evidence
      await adminDb.collection('audit_logs').add({
        actorUid: callerUid,
        actorRole: 'admin',
        action: 'view_evidence_photo',
        targetType: 'photo',
        targetId: photoId,
        ownerId: photo.ownerId,
        tenantId: photo.tenantId,
        createdAt: Timestamp.now(),
      });
    } else if (callerRole === 'owner') {
      if (photo.ownerId !== callerUid) {
        throw new AppError(403, 'Unauthorized photo access');
      }
    } else if (callerRole === 'staff') {
      if (photo.ownerId !== callerOwnerId) {
        throw new AppError(403, 'Unauthorized photo access');
      }
    } else if (callerRole === 'tenant') {
      if (photo.tenantId !== callerUid) {
        throw new AppError(403, 'Unauthorized photo access');
      }
    } else {
      throw new AppError(403, 'Forbidden');
    }

    const bucket = env.B2_BUCKET;
    const presignedUrl = await storageProvider.mintPresignedGet(
      bucket,
      photo.objectKey,
      PHOTO_URL_TTL_SECONDS
    );

    return {
      presignedUrl,
      photo: {
        id: photoDoc.id,
        photoType: photo.photoType,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        sha256: photo.sha256,
        createdAt: photo.createdAt?.toDate()?.toISOString(),
      },
    };
  }

  /**
   * Deletes a photo document from Firestore and removes the object from B2.
   */
  async deletePhoto(photoId: string, ownerId: string) {
    const photoDocRef = adminDb.collection('movein_photos').doc(photoId);
    const photoDoc = await photoDocRef.get();
    if (!photoDoc.exists) {
      throw new AppError(404, 'Photo not found');
    }

    const photoData = photoDoc.data()!;
    if (photoData.ownerId !== ownerId) {
      throw new AppError(403, 'Unauthorized');
    }

    // Delete Firestore record first
    await photoDocRef.delete();

    // Delete B2 storage object
    try {
      await storageProvider.deleteObject(env.B2_BUCKET, photoData.objectKey);
    } catch (e) {
      console.warn(`Failed to immediately delete B2 object: ${photoData.objectKey}`, e);
    }

    return { success: true };
  }

  // ---------------- PG GALLERY PHOTOS (PUBLIC) ----------------
  // Separate from tenant evidence photos: these are public-read, categorized,
  // and surfaced to prospective residents in discovery.

  /** Verify a property belongs to the owner (primary property id == ownerId). */
  private async assertPropertyOwned(ownerId: string, propertyId: string) {
    if (propertyId === ownerId) return; // primary property is always owned
    const propDoc = await adminDb.collection('properties').doc(propertyId).get();
    if (!propDoc.exists || propDoc.data()?.ownerId !== ownerId) {
      throw new AppError(403, 'Unauthorized property access');
    }
  }

  /** Presigned PUT for a PG gallery photo (pending/ buffer, like tenant photos). */
  async createPropertyUploadIntent(params: {
    ownerId: string;
    propertyId: string;
    contentType: string;
    sizeBytes: number;
  }) {
    const { ownerId, propertyId, contentType, sizeBytes } = params;

    if (!ALLOWED_MIME_TYPES.includes(contentType as AllowedMimeType)) {
      throw new AppError(400, `Invalid image format: ${contentType}. Allowed: image/webp, image/jpeg`);
    }
    if (sizeBytes > PHOTO_MAX_BYTES) {
      throw new AppError(400, `File size exceeds ${PHOTO_MAX_BYTES / (1024 * 1024)} MB`);
    }

    const [, countSnap] = await Promise.all([
      this.assertPropertyOwned(ownerId, propertyId),
      adminDb.collection('property_photos').where('propertyId', '==', propertyId).count().get(),
    ]);
    if (countSnap.data().count >= PROPERTY_PHOTO_MAX) {
      throw new AppError(403, `Gallery photo limit reached (${PROPERTY_PHOTO_MAX} per property).`);
    }

    const uuid = crypto.randomUUID();
    const ext = contentType === 'image/webp' ? 'webp' : 'jpg';
    const objectKey = `${STORAGE_PREFIX.PENDING}${ownerId}/property/${propertyId}/${uuid}.${ext}`;

    const uploadUrl = await storageProvider.mintPresignedPut(
      env.B2_BUCKET,
      objectKey,
      contentType,
      UPLOAD_URL_TTL_SECONDS
    );
    return { uploadUrl, objectKey, expiresSeconds: UPLOAD_URL_TTL_SECONDS };
  }

  /** Verify + publish a PG gallery photo as a public-read object, store metadata. */
  async confirmPropertyUpload(params: {
    ownerId: string;
    propertyId: string;
    objectKey: string;
    category: string;
    caption?: string;
    sharingType?: string;
    uploadedBy: string;
  }) {
    const { ownerId, propertyId, objectKey, caption, sharingType, uploadedBy } = params;

    const category = (PROPERTY_PHOTO_CATEGORIES as readonly string[]).includes(params.category)
      ? (params.category as PropertyPhotoCategory)
      : 'other';

    // Object key must belong to this owner's pending property buffer.
    const expectedPrefix = `${STORAGE_PREFIX.PENDING}${ownerId}/property/${propertyId}/`;
    if (!objectKey.startsWith(expectedPrefix)) {
      throw new AppError(403, 'Invalid or unauthorized object key');
    }
    await this.assertPropertyOwned(ownerId, propertyId);

    const bucket = env.B2_BUCKET;

    let head;
    try {
      head = await storageProvider.headObject(bucket, objectKey);
    } catch {
      throw new AppError(404, 'Uploaded file not found in storage buffer');
    }
    if (head.contentLength > PHOTO_MAX_BYTES) {
      await storageProvider.deleteObject(bucket, objectKey).catch(() => {});
      throw new AppError(400, 'File exceeds maximum allowed size');
    }

    const streamResult = await storageProvider.streamAndVerify(bucket, objectKey).catch(() => null);
    if (!streamResult) {
      await storageProvider.deleteObject(bucket, objectKey).catch(() => {});
      throw new AppError(500, 'Failed to inspect uploaded file');
    }
    if (!streamResult.magicValid) {
      await storageProvider.deleteObject(bucket, objectKey).catch(() => {});
      throw new AppError(422, 'File failed integrity check. Only valid WebP or JPEG images are accepted.');
    }

    const contentType = streamResult.contentType || head.contentType || 'image/webp';
    const destKey = objectKey.replace(STORAGE_PREFIX.PENDING, STORAGE_PREFIX.PROPERTY);

    try {
      await storageProvider.copyObjectPublic(bucket, objectKey, destKey, contentType);
      await storageProvider.deleteObject(bucket, objectKey);
    } catch {
      throw new AppError(500, 'Failed to publish gallery photo');
    }

    const publicUrl = storageProvider.publicObjectUrl(bucket, destKey);
    const docRef = adminDb.collection('property_photos').doc();
    const photoDoc = {
      id: docRef.id,
      ownerId,
      propertyId,
      category,
      caption: (caption || '').trim().slice(0, 120) || null,
      // Only accept known sharing values into the public doc.
      sharingType: ['1', '2', '3', '4', '5', '6'].includes(sharingType || '') ? sharingType : null,
      objectKey: destKey,
      publicUrl,
      contentType,
      sizeBytes: streamResult.contentLength,
      uploadedBy,
      createdAt: Timestamp.now(),
    };
    await docRef.set(photoDoc);

    // Denormalize a cover photo onto the property doc the FIRST time, so public
    // PG search can show a thumbnail without an N+1 per-listing photo query.
    const propRef = adminDb.collection('properties').doc(propertyId);
    const propSnap = await propRef.get();
    if (propSnap.exists && !propSnap.data()?.coverPhotoUrl) {
      await propRef.set({ coverPhotoUrl: publicUrl }, { merge: true }).catch(() => {});
    }

    return photoDoc;
  }

  /** Public list of a property's gallery photos (no auth needed). */
  async listPropertyPhotos(propertyId: string, limitCount = PROPERTY_PHOTO_MAX) {
    const snap = await adminDb
      .collection('property_photos')
      .where('propertyId', '==', propertyId)
      .limit(Math.min(limitCount, 100))
      .get();
    const photos = snap.docs.map((d) => d.data() as PropertyPhoto);
    // Sort newest-first in memory to avoid needing a composite index.
    photos.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    return photos.map((p) => ({
      id: p.id,
      category: p.category,
      caption: p.caption || null,
      sharingType: p.sharingType || null,
      publicUrl: p.publicUrl,
      createdAt: tsToDate(p.createdAt)?.toISOString() || null,
    }));
  }

  /** Owner deletes a gallery photo (Firestore + public object). */
  async deletePropertyPhoto(photoId: string, ownerId: string) {
    const ref = adminDb.collection('property_photos').doc(photoId);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError(404, 'Photo not found');
    const data = doc.data()!;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    await ref.delete();
    await storageProvider.deleteObject(env.B2_BUCKET, data.objectKey).catch(() => {});

    // If this was the denormalized cover photo, repoint it to any remaining
    // photo (or clear it) so public search never shows a dead thumbnail.
    const propRef = adminDb.collection('properties').doc(data.propertyId);
    const propSnap = await propRef.get();
    if (propSnap.exists && propSnap.data()?.coverPhotoUrl === data.publicUrl) {
      const remaining = await adminDb
        .collection('property_photos')
        .where('propertyId', '==', data.propertyId)
        .limit(1)
        .get();
      const nextCover = remaining.empty ? null : remaining.docs[0].data().publicUrl;
      await propRef.set({ coverPhotoUrl: nextCover }, { merge: true }).catch(() => {});
    }
    return { success: true };
  }
}

export const photosService = new PhotosService();
