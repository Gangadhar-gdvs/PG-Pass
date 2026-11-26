'use client';

import React, { useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { SupportChat } from '@/components/support/SupportChat';
import { SupportLink } from '@/components/ui/support-link';
import { LifeBuoy } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerSupportPage() {
  const { ownerId } = useOwnerSession();

  // Clear the owner's unread badge whenever they open the chat.
  const markRead = () => {
    fetch('/api/support/messages', { method: 'PATCH' }).catch(() => {});
  };
  useEffect(() => {
    markRead();
  }, []);

  const send = async (text: string) => {
    const res = await fetch('/api/support/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || 'Could not send message');
      throw new Error('send failed');
    }
  };

  return (
    // Full-bleed on mobile (negative margins cancel the shell's px/py so the chat
    // uses the whole window between the sticky top bar and bottom tab bar); a
    // comfortable centred card on desktop. Fixed height + inner min-h-0 means
    // ONLY the chat message list scrolls — the page itself never scrolls.
    // Height subtracts the sticky top bar (3.5rem), the floating bottom tab bar
    // (~6rem), and the device's bottom safe-area inset so the chat input never
    // hides under a home indicator on notched phones.
    <div className="-mx-4 -my-4 md:mx-auto md:my-0 md:max-w-2xl md:px-4 md:py-5 flex flex-col h-[calc(100dvh-3.5rem-6rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)]">
      <header className="flex items-center gap-3 px-4 py-3 md:px-0 md:pt-0 md:pb-4 shrink-0 border-b border-slate-100 md:border-0">
        <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl accent-soft-bg flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 accent-text" />
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900">Support</h1>
          <p className="text-xs text-slate-500">Chat directly with the PG-Pass team</p>
        </div>
      </header>

      <div className="md:app-card flex-1 min-h-0 flex flex-col overflow-hidden p-0 bg-white">
        <SupportChat
          threadOwnerId={ownerId}
          viewerSide="owner"
          onSend={send}
          onOpen={markRead}
          emptyHint="Have an issue or question? Send us a message and we'll reply here. Replies appear live."
        />
      </div>

      <div className="py-2 md:mt-3 text-center shrink-0">
        <SupportLink />
      </div>
    </div>
  );
}
