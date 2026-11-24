import 'server-only';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Single-active-session registry (one login per account — Jio/Hotstar style).
 *
 * Each user doc (`owners/{uid}`, `residents/{uid}`, `staff/{uid}`) stores a
 * `currentSessionId`. The browser holds the same id in the `__pgp_sid` cookie.
 * A newer login overwrites `currentSessionId`, so the previous device's cookie
 * no longer matches and is treated as superseded (logged out).
 *
 * Admins are exempt (super-admin console may run on several screens).
 */

type Role = 'owner' | 'staff' | 'admin' | 'tenant' | 'resident';

/** Which Firestore doc tracks this role's active session (null = not tracked). */
function sessionDocRef(role: Role, uid: string) {
  if (role === 'owner') return adminDb.collection('owners').doc(uid);
  if (role === 'staff') return adminDb.collection('staff').doc(uid);
  if (role === 'resident' || role === 'tenant') return adminDb.collection('residents').doc(uid);
  return null; // admin → exempt
}

/** Read the currently-registered session id for a user (null if none/exempt). */
export async function getActiveSessionId(role: Role, uid: string): Promise<string | null> {
  const ref = sessionDocRef(role, uid);
  if (!ref) return null;
  const snap = await ref.get();
  return (snap.exists ? (snap.data()?.currentSessionId as string | undefined) : undefined) || null;
}

/** Register a new active session, superseding any previous device. */
export async function setActiveSession(
  role: Role,
  uid: string,
  sessionId: string,
  device?: string
): Promise<void> {
  const ref = sessionDocRef(role, uid);
  if (!ref) return;
  await ref.set(
    {
      currentSessionId: sessionId,
      currentSessionAt: FieldValue.serverTimestamp(),
      ...(device ? { currentSessionDevice: device.slice(0, 200) } : {}),
    },
    { merge: true }
  );
}

/** Clear the active session (explicit logout = log out everywhere). */
export async function clearActiveSession(role: Role, uid: string): Promise<void> {
  const ref = sessionDocRef(role, uid);
  if (!ref) return;
  await ref
    .update({ currentSessionId: FieldValue.delete(), currentSessionDevice: FieldValue.delete() })
    .catch(() => {});
}

/**
 * True when `sessionId` is the registered active session for this user (or the
 * role is exempt / untracked). False means this device was superseded.
 */
export async function isSessionCurrent(
  role: Role,
  uid: string,
  sessionId: string | undefined
): Promise<boolean> {
  const ref = sessionDocRef(role, uid);
  if (!ref) return true; // exempt roles are always "current"
  const active = await getActiveSessionId(role, uid);
  if (!active) return true; // nothing registered yet → don't lock anyone out
  return !!sessionId && sessionId === active;
}
