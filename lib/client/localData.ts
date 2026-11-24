'use client';

/**
 * Clears all app-owned client-side storage on logout. Only touches data the app
 * itself stored in the browser (localStorage keys under the `pgpass_` prefix +
 * sessionStorage) — never Firestore/DB or any server-side data.
 *
 * Current client-stored items:
 *  - `pgpass_selected_property`  (owner's last-selected property)
 *  - `pgpass_pin_<token>`        (tenant portal PIN convenience cache — sensitive)
 */
export function clearLocalData(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pgpass_')) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage may be unavailable (private mode) — ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}
