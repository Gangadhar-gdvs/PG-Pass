'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Mail, CheckCircle2, Link2Off } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

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
      if (!res.ok) throw new Error('failed');
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
    <div className="app-card rounded-[16px] p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="icon-chip accent-text"><Mail className="h-5 w-5" /></span>
        <div>
          <h2 className="text-sm font-bold text-[#0F172A]">Rent reminders from your Gmail</h2>
          <p className="text-[11px] text-[#64748B]">Send reminder emails directly from your own inbox — one button, no manual Gmail.</p>
        </div>
      </div>

      {status.connected ? (
        <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-[#065F46] min-w-0">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Connected{status.email ? ` · ${status.email}` : ''}</span>
          </span>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#DC2626] px-2 py-1 rounded hover:bg-[#FEF2F2] shrink-0"
          >
            <Link2Off className="h-3.5 w-3.5" /> Disconnect
          </button>
        </div>
      ) : (
        <a href="/api/owners/gmail/connect" className="inline-block">
          <Button size="sm" variant="solid" type="button">
            <Mail className="h-3.5 w-3.5 mr-1.5" /> Connect Gmail
          </Button>
        </a>
      )}
    </div>
  );
}
