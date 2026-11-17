import { config } from './config';
import { validateFileUpload } from './security';

export const compressImage = (file: File, maxWidth = 1024): Promise<File> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(file);
      return;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
};

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const uploadToCloudinary = async (file: File, folder: string): Promise<string> => {
  // Enforce strict file size and MIME-type validation before uploading
  const validation = validateFileUpload(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  const compressed = await compressImage(file);

  // If Cloudinary credentials are not configured, safely fall back to local Base64 data URL
  if (!config.cloudinary.isConfigured()) {
    return await fileToDataUrl(compressed);
  }

  const formData = new FormData();
  formData.append('file', compressed);
  formData.append('upload_preset', config.cloudinary.uploadPreset);
  formData.append('folder', `pgpass/${folder}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!data.secure_url) {
    throw new Error('Upload failed: ' + (data.error?.message || 'Unknown error'));
  }
  return data.secure_url;
};
