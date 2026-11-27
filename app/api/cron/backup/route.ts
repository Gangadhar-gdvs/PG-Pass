import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withCronAuth } from '@/lib/server/api/withCronAuth';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { storageProvider } from '@/lib/server/storage/provider';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { env } from '@/lib/env';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_SPECS,
  authArtifact,
  backupKeyStatus,
  collectionArtifact,
  exportAuthUsers,
  exportCollectionDocs,
  manifestKey,
  newManifest,
  type Artifact,
} from '@/lib/server/backup/format';

/**
 * Nightly encrypted backup (format v2, lib/server/backup/format.ts): every
 * business collection + sub-collection + Firebase Auth users, one AES-256-GCM
 * object each, then a manifest. Each upload is verified by size; the manifest
 * carries sha256 per object so a restore can prove completeness.
 */
export const POST = withErrorHandler(
  withCronAuth(async () => {
    const date = new Date().toISOString().split('T')[0];
    const keyState = backupKeyStatus(env.BACKUP_ENCRYPTION_KEY);

    // A malformed key must never silently weaken encryption (v1 zero-padded it).
    if (keyState === 'invalid') {
      await recordEvent({
        category: 'cron',
        level: 'error',
        message: `Nightly backup ${date} REFUSED: BACKUP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes) — generate one with \`openssl rand -hex 32\``,
      });
      return NextResponse.json(
        { success: false, backupDate: date, error: 'Backup refused: BACKUP_ENCRYPTION_KEY is malformed (expected 64 hex characters).' },
        { status: 500 }
      );
    }

    const bucket = env.B2_BACKUP_BUCKET;
    if (!bucket || keyState !== 'valid') {
      // Not configured: don't burn a full-database read on the free tier for nothing.
      await recordEvent({
        category: 'cron',
        level: bucket ? 'warn' : 'info',
        message: `Nightly backup ${date}: skipped — ${bucket ? 'BACKUP_ENCRYPTION_KEY not set' : 'B2 backup bucket not configured'}`,
      });
      return NextResponse.json({
        success: true,
        backupDate: date,
        backupConfigured: false,
        encryptedToB2: false,
        collectionCounts: {},
        uploadedBytes: {},
      });
    }

    const key = env.BACKUP_ENCRYPTION_KEY!;
    const createdAt = new Date().toISOString();
    const manifest = newManifest(date, createdAt);
    const collectionCounts: Record<string, number> = {};
    const uploadedBytes: Record<string, number> = {};

    const upload = async ({ blob, entry }: Artifact) => {
      await storageProvider.putObject(bucket, entry.objectKey, blob, 'application/octet-stream');
      const head = await storageProvider.headObject(bucket, entry.objectKey);
      if (head.contentLength !== blob.length) {
        throw new Error(`Backup verification failed for ${entry.objectKey}: sent ${blob.length} bytes, stored ${head.contentLength}`);
      }
      manifest.artifacts.push(entry);
      uploadedBytes[entry.path] = blob.length;
    };

    // One collection at a time keeps memory bounded to the largest collection.
    for (const spec of BACKUP_SPECS) {
      const docs = await exportCollectionDocs(adminDb, spec);
      collectionCounts[spec.path] = docs.length;
      await upload(collectionArtifact(date, spec.path, docs, key, createdAt));
    }
    const users = await exportAuthUsers(adminAuth);
    await upload(authArtifact(date, users, key, createdAt));

    const manifestBody = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');
    await storageProvider.putObject(bucket, manifestKey(date), manifestBody, 'application/json');

    const totalDocs = Object.values(collectionCounts).reduce((a, b) => a + b, 0);
    await recordEvent({
      category: 'cron',
      level: 'info',
      message: `Nightly backup ${date}: ${totalDocs} docs in ${BACKUP_SPECS.length} collections + ${users.length} auth users · uploaded+verified to B2 (format v${BACKUP_FORMAT_VERSION})`,
      details: { collectionCounts, uploadedBytes, authUsers: users.length },
    });

    return NextResponse.json({
      success: true,
      backupDate: date,
      formatVersion: BACKUP_FORMAT_VERSION,
      collectionCounts,
      authUsers: users.length,
      uploadedBytes,
      encryptedToB2: true,
      backupConfigured: true,
    });
  })
);
