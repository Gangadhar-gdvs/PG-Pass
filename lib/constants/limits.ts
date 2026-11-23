// Pagination limits
export const PAGE_SIZE_DEFAULT = 25;
export const MAX_LIST_LIMIT = 100;

// Plan tier limits: maxBeds, maxPhotos, maxStaff
export const PLAN_LIMITS = {
  free: {
    maxBeds: 20,
    maxPhotos: 40,
    maxStaff: 0,
  },
  growth: {
    maxBeds: 100,
    maxPhotos: 500,
    maxStaff: 1,
  },
  pro: {
    maxBeds: 500,
    maxPhotos: 2500,
    maxStaff: 5,
  },
} as const;

export const FREE_MAX_BEDS = 20;
export const FREE_MAX_PHOTOS = 40;
export const FREE_MAX_STAFF = 0;

export const GROWTH_MAX_BEDS = 100;
export const GROWTH_MAX_PHOTOS = 500;
export const GROWTH_MAX_STAFF = 1;

export const PRO_MAX_BEDS = 500;
export const PRO_MAX_PHOTOS = 2500;
export const PRO_MAX_STAFF = 5;

// Media & file upload limits
export const PHOTO_TARGET_BYTES = 150_000; // ~150 KB target for client-compressed WebP
export const PHOTO_MAX_BYTES = 5_242_880; // 5 MB hard server cap
export const PHOTO_ALLOWED_TYPES = ['image/webp', 'image/jpeg'] as const;
export const UPLOAD_URL_TTL_SECONDS = 300; // 5 minutes
export const PHOTO_URL_TTL_SECONDS = 300; // 5 minutes

// Portal & Session limits
export const PORTAL_TOKEN_TTL_DAYS = 90;
export const PORTAL_TOKEN_RETENTION_DAYS = 30;
export const PORTAL_PIN_MAX_ATTEMPTS = 5;
export const PORTAL_PIN_LOCKOUT_MINUTES = 15;
export const SESSION_MAX_AGE_DAYS = 7;
export const SESSION_COOKIE_NAME = '__session';

// Data Retention & Undo limits
export const SOFT_DELETE_UNDO_DAYS = 7;
export const BACKUP_RETENTION_DAYS = 30;
export const RETENTION_TENANT_DAYS = 365;
export const PHOTO_RETENTION_DAYS = 90;
