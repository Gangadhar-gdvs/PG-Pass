'use client';

import { apiErrorMessage } from '@/lib/utils';
import React, { useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { SupportChat } from '@/components/support/SupportChat';
import { SupportLink } from '@/components/ui/support-link';
import { PageHeader } from '@/components/ui/dashboard-kit';
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
      toast.error(apiErrorMessage(err, 'Could not send message'));
      throw new Error('send failed');
    }
  };

  return (
    // Fixed height + inner min-h-0 means ONLY the chat message list scrolls —
    // the page itself never scrolls. Height subtracts the sticky top bar
    // (3.5rem), the floating bottom tab bar (~6rem), and the device's bottom
    // safe-area inset so the chat input never hides under a home indicator on
    // notched phones. Mobile cancels the shell's vertical padding (-my-4) so the
    // chat card gets every pixel between the bars; desktop is a centred column.
    <div className="-my-4 md:mx-auto md:my-0 md:max-w-2xl flex flex-col gap-3 md:gap-4 py-3 md:py-0 h-[calc(100dvh-3.5rem-6rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)]">
      <PageHeader
        icon="bell-purple"
        tint="violet"
        title="Support"
        subtitle="Chat directly with the PG-Pass team"
        className="shrink-0"
      />

      <div className="app-card flex-1 min-h-0 flex flex-col overflow-hidden">
        <SupportChat
          threadOwnerId={ownerId}
          viewerSide="owner"
          onSend={send}
          onOpen={markRead}
          emptyHint="Have an issue or question? Send us a message and we'll reply here. Replies appear live."
        />
      </div>

      <div className="shrink-0 text-center">
        <SupportLink />
      </div>
    </div>
  );
}
