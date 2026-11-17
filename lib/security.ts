import { config } from './config';

/**
 * Strict Security & Validation Helpers
 */

export function sanitizeText(input: string, maxLength: number = 200): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Strip script injection tags
    .trim()
    .slice(0, maxLength);
}

export function validatePhone(phone: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = phone.replace(/\D/g, '');
  const tenDigits = cleaned.length > 10 && cleaned.startsWith('91') ? cleaned.slice(-10) : cleaned;

  if (!config.security.phoneRegex.test(tenDigits)) {
    return {
      valid: false,
      cleaned: tenDigits,
      error: 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)',
    };
  }

  return { valid: true, cleaned: tenDigits };
}

export function validatePan(pan: string): { valid: boolean; formatted: string; error?: string } {
  const formatted = pan.trim().toUpperCase();
  if (!config.security.panRegex.test(formatted)) {
    return {
      valid: false,
      formatted,
      error: 'Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)',
    };
  }
  return { valid: true, formatted };
}

export function validateUpi(upi: string): { valid: boolean; formatted: string; error?: string } {
  const formatted = upi.trim().toLowerCase();
  if (!config.security.upiRegex.test(formatted)) {
    return {
      valid: false,
      formatted,
      error: 'Invalid UPI ID format. Expected format: username@bank (e.g., name@okicici)',
    };
  }
  return { valid: true, formatted };
}

export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  // Verify file size limit
  if (file.size > config.security.maxUploadSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${(config.security.maxUploadSizeBytes / (1024 * 1024)).toFixed(0)}MB limit. Please choose a smaller photo.`,
    };
  }

  // Verify mime type
  const allowedTypes: readonly string[] = config.security.allowedImageMimeTypes;
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPEG, PNG, and WebP images are allowed.',
    };
  }

  return { valid: true };
}
