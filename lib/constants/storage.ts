export const STORAGE_PREFIX = {
  PENDING: 'pending/',
  MOVEIN: 'movein/',
  MOVEOUT: 'moveout/',
  PAYMENT_PROOF: 'payment_proof/',
} as const;

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/webp'] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
