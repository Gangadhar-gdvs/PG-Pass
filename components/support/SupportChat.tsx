'use client';

import React, { useEffect, useRef, useState } from 'react';
import { subscribeToSupportMessages } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import type { SupportMessage } from '@/types';

/**
 * Live owner↔admin chat. Messages stream in via Firestore onSnapshot (server
 * push — no polling). Sending goes through the provided API callback.
 *
 * `viewerSide` = which side is viewing ('owner' or 'admin') so bubbles align.
 */
export function SupportChat({
  threadOwnerId,
  viewerSide,
  onSend,
  onOpen,
  emptyHint,
}: {
  threadOwnerId: string;
  viewerSide: 'owner' | 'admin';
  onSend: (text: string) => Promise<void>;
  onOpen?: () => void;
  emptyHint?: string;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live subscription (push). Re-subscribes if the thread changes. A 12s timeout
  // guards against a silent hang (unreachable Firestore / missing index).
  useEffect(() => {
    if (!threadOwnerId) return;
    onOpen?.();
    setLoading(true);
    setError(false);
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLoading(false);
        setError(true);
      }
    }, 12_000);
    const unsub = subscribeToSupportMessages(
      threadOwnerId,
      (msgs) => {
        settled = true;
        clearTimeout(timeout);
        setMessages(msgs);
        setError(false);
        setLoading(false);
      },
      () => {
        settled = true;
        clearTimeout(timeout);
        setError(true);
        setLoading(false);
      }
    );
    return () => {
      clearTimeout(timeout);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadOwnerId]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 p-3">
        {loading && (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                <div className={`h-9 rounded-[16px] animate-shimmer bg-[#F5F3EF] ${i % 2 ? 'w-40' : 'w-52'}`} />
              </div>
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[#DC2626] px-6 gap-1">
            <span className="font-semibold">Couldn&apos;t load messages</span>
            <span className="text-slate-400">Check your connection — new messages will appear once reconnected.</span>
          </div>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center text-xs text-slate-400 px-6">
            {emptyHint || 'No messages yet. Start the conversation below.'}
          </div>
        )}
        {!loading && messages.map((m) => {
          const mine = m.sender === viewerSide;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-up`}>
              <div
                className={`max-w-[80%] px-3.5 py-2 rounded-[16px] text-sm ${
                  mine ? 'accent-bg rounded-br-sm' : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                }`}
              >
                <span className="block whitespace-pre-wrap break-words">{m.text}</span>
                <span className={`block text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                  {m.sender === 'admin' ? 'Support' : 'You'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 p-3 border-t border-slate-100">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={2000}
          className="flex-1 h-11 px-4 rounded-full border-2 border-slate-200 text-sm focus:border-[color:var(--accent)] focus:outline-none"
        />
        <Button type="submit" variant="solid" size="md" loading={sending} disabled={!text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
