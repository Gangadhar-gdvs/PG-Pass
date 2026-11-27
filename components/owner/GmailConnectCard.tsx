'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Link2Off } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfoBanner } from '@/components/ui/dashboard-kit';
import { IconTile } from '@/components/brand/Icon3D';
import toast from 'react-hot-toast';
import { errorMessage, readApiError } from '@/lib/utils';

interface GmailStatus {
  available: boolean;
  connected: boolean;
  email?: string;
}

/**
 * Lets the owner connect their OWN Gmail so rent reminders send directly from
 * their inbox (one button, no manual Gmail). Hidden entirely when the server
 * isn't configured for it (keeps the app ₹0 by default).
 */
export function GmailConnectCard() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/owners/gmail');
      if (res.ok) setStatus(await res.json());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    // Reflect the result of the OAuth round-trip (?gmail=connected|error).
    const params = new URLSearchParams(window.location.search);
    const g = params.get('gmail');
    if (g === 'connected') toast.success('Gmail connected — reminders will send from your inbox');
    else if (g === 'error') toast.error('Could not connect Gmail. Please try again.');
    if (g) window.history.replaceState({}, '', window.location.pathname);
    return () => {
      active = false;
    };
  }, [load]);

  const disconnect = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/owners/gmail', { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Could not disconnect'));
      toast.success('Gmail disconnected');
      setStatus((s) => (s ? { ...s, connected: false, email: undefined } : s));
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not disconnect'));
    } finally {
      setBusy(false);
    }
  };

  // Server not configured for Gmail → don't show anything (feature is optional).
  if (!status || !status.available) return null;

  return (
    <section className="app-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <IconTile icon="bell" tint="peach" size={48} />
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold leading-snug tracking-[-0.015em] text-ink">Rent reminders from your Gmail</h2>
          <p className="mt-0.5 text-[13px] font-medium leading-relaxed text-muted">
            Send reminder emails directly from your own inbox — one button, no manual Gmail.
          </p>
        </div>
      </div>

      {status.connected ? (
        <InfoBanner
          tone="success"
          title="Connected"
          description={status.email ? <span className="break-all">{status.email}</span> : undefined}
          className="animate-pop"
          action={
            <Button variant="outline" onClick={disconnect} disabled={busy} className="w-full sm:w-auto">
              <Link2Off className="h-4 w-4" /> Disconnect
            </Button>
          }
        />
      ) : (
        <a href="/api/owners/gmail/connect" className="btn-pill w-full sm:w-auto">
          <Mail className="h-4 w-4" /> Connect Gmail
        </a>
      )}
    </section>
  );
}
