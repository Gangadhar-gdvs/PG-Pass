import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';
import crypto from 'crypto';
import { Readable } from 'stream';

export const b2 = new S3Client({
  region: env.B2_REGION,
  endpoint: env.B2_ENDPOINT,
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APP_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export async function mintPresignedPut(
  bucket: string,
  key: string,
  contentType: string,
  ttlSeconds = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(b2, command, { expiresIn: ttlSeconds });
}

export async function mintPresignedGet(
  bucket: string,
  key: string,
  ttlSeconds = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseCacheControl: 'private, no-store',
  });
  return getSignedUrl(b2, command, { expiresIn: ttlSeconds });
}

export async function headObject(
  bucket: string,
  key: string
): Promise<{ contentLength: number; contentType?: string }> {
  const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
  const res = await b2.send(command);
  return {
    contentLength: res.ContentLength ?? 0,
    contentType: res.ContentType,
  };
}

export async function copyObject(
  bucket: string,
  sourceKey: string,
  destKey: string
): Promise<void> {
  const command = new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${sourceKey}`,
    Key: destKey,
  });
  await b2.send(command);
}

export async function deleteObject(
  bucket: string,
  key: string
): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await b2.send(command);
}

function verifyMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // JPEG check: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  // WebP check: RIFF....WEBP
  const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isRiff && isWebp;
}

export async function streamAndVerify(
  bucket: string,
  key: string
): Promise<{
  contentLength: number;
  contentType?: string;
  sha256: string;
  magicValid: boolean;
}> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await b2.send(command);
  const stream = response.Body as Readable;

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    let totalBytes = 0;
    const initialChunks: Buffer[] = [];
    let initialBytesRead = 0;

    stream.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      hash.update(chunk);
      if (initialBytesRead < 64) {
        initialChunks.push(chunk);
        initialBytesRead += chunk.length;
      }
    });

    stream.on('end', () => {
      const headerBuffer = Buffer.concat(initialChunks);
      const magicValid = verifyMagicBytes(headerBuffer);
      resolve({
        contentLength: totalBytes,
        contentType: response.ContentType,
        sha256: hash.digest('hex'),
        magicValid,
      });
    });

    stream.on('error', (err) => reject(err));
  });
}
