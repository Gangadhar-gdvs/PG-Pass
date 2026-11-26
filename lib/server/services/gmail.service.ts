import 'server-only';
import { adminDb } from '../firebase-admin';
import { env } from '@/lib/env';
import { encryptSecret, decryptSecret } from '../security/secrets';
import { AppError } from '../api/withErrorHandler';

/**
 * "Send from the owner's OWN Gmail" via the Gmail API + OAuth2 refresh token.
 * No SDK — raw fetch to Google's REST endpoints (keeps the app lean/dependency-
 * free). All three of GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
 * SECRETS_ENCRYPTION_KEY must be set for the feature to be available; otherwise
 * it's gracefully disabled and callers fall back to the WhatsApp flow.
 *
 * The owner's refresh token is stored ENCRYPTED on `owners/{ownerId}.gmail`.
 */

const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export function gmailConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SECRETS_ENCRYPTION_KEY);
}

function redirectUri(): string {
  const base = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/owners/gmail/callback`;
}

/** The Google consent URL an owner is sent to. `state` carries the owner uid. */
export function buildConsentUrl(state: string): string {
  if (!gmailConfigured()) throw new AppError(400, 'Gmail sending is not configured on this server');
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline', // request a refresh token
    prompt: 'consent', // force refresh-token issuance on re-consent
    state,
    include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Exchange the one-time auth `code` for tokens and store the refresh token. */
export async function connectOwnerGmail(ownerId: string, code: string): Promise<string> {
  if (!gmailConfigured()) throw new AppError(400, 'Gmail sending is not configured');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.refresh_token) {
    throw new AppError(400, data.error_description || 'Google did not return a refresh token. Please try connecting again.');
  }

  // Resolve the connected email address (nice to show in the UI).
  let email = '';
  try {
    const profile = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (profile.ok) email = ((await profile.json()) as { emailAddress?: string }).emailAddress || '';
  } catch {
    /* non-fatal */
  }

  await adminDb.collection('owners').doc(ownerId).set(
    {
      gmail: {
        connected: true,
        email,
        refreshTokenEnc: encryptSecret(data.refresh_token),
        connectedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
  return email;
}

export async function disconnectOwnerGmail(ownerId: string): Promise<void> {
  await adminDb.collection('owners').doc(ownerId).set(
    { gmail: { connected: false, email: '', refreshTokenEnc: '' } },
    { merge: true }
  );
}

export interface OwnerGmailStatus {
  available: boolean; // server configured
  connected: boolean; // this owner connected
  email?: string;
}

export async function getOwnerGmailStatus(ownerId: string): Promise<OwnerGmailStatus> {
  const available = gmailConfigured();
  if (!available) return { available: false, connected: false };
  const snap = await adminDb.collection('owners').doc(ownerId).get();
  const g = (snap.data()?.gmail as { connected?: boolean; email?: string; refreshTokenEnc?: string } | undefined) || {};
  return { available: true, connected: Boolean(g.connected && g.refreshTokenEnc), email: g.email };
}

/** Get a short-lived access token for the owner from their stored refresh token. */
async function getAccessToken(ownerId: string): Promise<string> {
  const snap = await adminDb.collection('owners').doc(ownerId).get();
  const g = snap.data()?.gmail as { refreshTokenEnc?: string } | undefined;
  if (!g?.refreshTokenEnc) throw new AppError(400, 'This PG has not connected a Gmail account.');
  const refreshToken = decryptSecret(g.refreshTokenEnc);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    // Refresh token revoked/expired → mark disconnected so the UI prompts reconnect.
    if (data.error === 'invalid_grant') {
      await disconnectOwnerGmail(ownerId).catch(() => {});
      throw new AppError(400, 'Gmail access expired — please reconnect your Google account.');
    }
    throw new AppError(502, 'Could not authenticate with Gmail. Please try again.');
  }
  return data.access_token;
}

function buildRawMessage(to: string, from: string, subject: string, html: string): string {
  // RFC 2822 message, base64url-encoded for the Gmail API.
  const headers = [
    `To: ${to}`,
    from ? `From: ${from}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
  ]
    .filter(Boolean)
    .join('\r\n');
  const msg = `${headers}\r\n\r\n${html}`;
  return Buffer.from(msg).toString('base64url');
}

/** Send one email from the owner's Gmail. Returns true on success. */
export async function sendFromOwnerGmail(
  ownerId: string,
  params: { to: string; subject: string; html: string; fromName?: string }
): Promise<boolean> {
  const status = await getOwnerGmailStatus(ownerId);
  if (!status.connected) return false;
  const accessToken = await getAccessToken(ownerId);
  const from = status.email ? `${params.fromName || 'PG'} <${status.email}>` : '';
  const raw = buildRawMessage(params.to, from, params.subject, params.html);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  return res.ok;
}
