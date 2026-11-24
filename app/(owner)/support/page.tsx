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
    <div className="max-w-2xl mx-auto px-4 py-5 pb-28 md:pb-10">
      <header className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl accent-soft-bg flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 accent-text" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Support</h1>
          <p className="text-xs text-slate-500">Chat directly with the PG-Pass team</p>
        </div>
      </header>

      <div className="app-card h-[70vh] min-h-[460px] flex flex-col overflow-hidden p-0">
        <SupportChat
          threadOwnerId={ownerId}
          viewerSide="owner"
          onSend={send}
          onOpen={markRead}
          emptyHint="Have an issue or question? Send us a message and we'll reply here. Replies appear live."
        />
      </div>

      <div className="mt-4 text-center">
        <SupportLink />
      </div>
    </div>
  );
}
