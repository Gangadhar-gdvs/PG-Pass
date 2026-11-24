export const STORAGE_PREFIX = {
  PENDING: 'pending/',
  MOVEIN: 'movein/',
  MOVEOUT: 'moveout/',
  PAYMENT_PROOF: 'payment_proof/',
  ID_PROOF: 'id_proof/',
  AGREEMENT: 'agreement/',
  PROPERTY: 'property/', // PG gallery photos — PUBLIC-read, shown in discovery
} as const;

// PG gallery photo categories (owner tags each uploaded photo).
export const PROPERTY_PHOTO_CATEGORIES = [
  'exterior',
  'room',
  'bathroom',
  'common',
  'food',
  'amenity',
  'other',
] as const;
export type PropertyPhotoCategory = (typeof PROPERTY_PHOTO_CATEGORIES)[number];

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/webp'] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
