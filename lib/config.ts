/**
 * PGPass Centralized Configuration & Security Rules
 * All environment variables and security constants MUST be accessed from this file.
 */

// Centralized Environment Variables with Type Safety & Defaults
export const config = {
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'PGPass',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    isConfigured: (): boolean => {
      const k = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const p = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      return Boolean(k && k.length > 10 && k !== 'demo-api-key' && p && p !== 'pgpass-demo');
    },
  },

  security: {
    // Max file upload limits (prevent denial of service and memory crashes)
    maxUploadSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
    
    // OTP rate limiting & lockout
    otpCooldownSeconds: 30,
    maxOtpAttemptsPerSession: 5,
    
    // PAN regex: 5 uppercase letters, 4 numbers, 1 uppercase letter
    panRegex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    
    // Phone regex: 10 Indian digits
    phoneRegex: /^[6-9]\d{9}$/,
    
    // UPI ID regex (e.g., username@bank)
    upiRegex: /^[\w.-]+@[\w.-]+$/,
    
    // Token length for unguessable public tenant URLs
    tokenLength: 12,
  },

  admin: {
    // Master secret key for super admin portal (accessible only by you)
    secretKey: process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || 'pgpass_admin_secret_2026',
    adminPhone: process.env.NEXT_PUBLIC_ADMIN_PHONE || '919876543210',
  },
} as const;

export default config;
