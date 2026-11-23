import { PHOTO_TARGET_BYTES, PHOTO_MAX_BYTES } from '@/lib/constants/limits';

export interface CompressedImageResult {
  file: File;
  blob: Blob;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Compresses an image in the browser on a HTML5 Canvas.
 * - Targets ~100-150 KB WebP format.
 * - Automatically strips private EXIF metadata (including GPS coordinates).
 * - Falls back to JPEG if WebP is unsupported.
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600
): Promise<CompressedImageResult> {
  if (typeof window === 'undefined') {
    return {
      file,
      blob: file,
      width: 0,
      height: 0,
      sizeBytes: file.size,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down proportionally
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get 2D canvas context'));
        return;
      }

      // Draw image onto canvas (strips EXIF metadata automatically)
      ctx.drawImage(img, 0, 0, width, height);

      // Determine format: WebP preferred, fallback JPEG
      const mimeType = 'image/webp';
      let quality = 0.82;

      const exportBlob = (q: number): Promise<Blob | null> => {
        return new Promise((res) => canvas.toBlob(res, mimeType, q));
      };

      let blob = await exportBlob(quality);

      // If WebP is unsupported or failed, fallback to JPEG
      if (!blob || blob.type !== mimeType) {
        blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
      }

      // Step down quality if image exceeds target bytes
      if (blob && blob.size > PHOTO_TARGET_BYTES && quality > 0.5) {
        quality = 0.65;
        const smallerBlob = await exportBlob(quality);
        if (smallerBlob && smallerBlob.size < blob.size) {
          blob = smallerBlob;
        }
      }

      if (!blob) {
        reject(new Error('Failed to compress image'));
        return;
      }

      const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const cleanFileName = `photo_${Date.now()}.${extension}`;
      const compressedFile = new File([blob], cleanFileName, {
        type: blob.type,
        lastModified: Date.now(),
      });

      resolve({
        file: compressedFile,
        blob,
        width,
        height,
        sizeBytes: blob.size,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file for compression'));
    };

    img.src = objectUrl;
  });
}
