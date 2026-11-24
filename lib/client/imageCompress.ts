import { PHOTO_TARGET_BYTES } from '@/lib/constants/limits';

export interface CompressedImageResult {
  file: File;
  blob: Blob;
  width: number;
  height: number;
  sizeBytes: number;
}

// Reject the raw file before we ever allocate a canvas. A 40–60 MP phone photo
// (20+ MB) decoded at full resolution can freeze or crash a mid-range mobile
// browser for 15–30 s. Real camera JPEGs are comfortably under this; anything
// larger is almost certainly not a photo we want to process on the main thread.
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB
// Guard against decompression-bomb / absurd dimensions even within the byte cap.
const MAX_INPUT_PIXELS = 50 * 1_000_000; // 50 MP

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

  // Up-front guards — reject before allocating any canvas / decoding the image.
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, or WebP).');
  }
  if (file.size > MAX_INPUT_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `This image is too large (${mb} MB). Please pick one under 25 MB.`
    );
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      if (width * height > MAX_INPUT_PIXELS) {
        reject(
          new Error('This image has too many pixels to process. Please pick a smaller one.')
        );
        return;
      }

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
