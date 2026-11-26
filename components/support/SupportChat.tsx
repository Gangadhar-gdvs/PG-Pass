'use client';

import React, { useEffect, useRef, useState } from 'react';
import { subscribeToSupportMessages } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Send, Check, CheckCheck } from 'lucide-react';
import type { SupportMessage } from '@/types';

/** Firestore Timestamp | Date | ISO string → Date (or null if unparseable). */
function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** "Today" / "Yesterday" / "12 Nov 2026" for a date separator. */
function dayLabel(d: Date): string {
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** HH:MM in 12-hour Indian format for a message timestamp. */
function timeLabel(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

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
    // Reset loading/error for the (re)subscription in a microtask so these don't
    // run synchronously inside the effect body (cascading-render lint rule).
    queueMicrotask(() => {
      setLoading(true);
      setError(false);
    });
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 px-3 py-4 sm:px-5">
        {loading && (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`h-11 animate-shimmer rounded-[20px] ${
                    i % 2 ? 'w-40 rounded-br-md' : 'w-52 rounded-bl-md'
                  }`}
                />
              </div>
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon3d="alert"
              className="py-6"
              title="Couldn't load messages"
              description="Check your connection — new messages will appear once reconnected."
            />
          </div>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon3d="bell-purple"
              className="py-6"
              title="No messages yet"
              description={emptyHint || 'Start the conversation below.'}
            />
          </div>
        )}
        {!loading && messages.map((m, i) => {
          const mine = m.sender === viewerSide;
          const when = toDate(m.createdAt);
          // Insert a date separator whenever the calendar day changes.
          const prevWhen = i > 0 ? toDate(messages[i - 1].createdAt) : null;
          const showDaySep =
            when && (!prevWhen || when.toDateString() !== prevWhen.toDateString());
          // "Seen" is derived honestly (no per-message receipts exist): one of my
          // messages counts as seen once the OTHER side has sent any later message.
          const seen =
            mine && messages.slice(i + 1).some((n) => n.sender !== viewerSide);
          return (
            <React.Fragment key={m.id}>
              {showDaySep && when && (
                <div className="flex justify-center py-1">
                  <span className="rounded-full border border-white bg-white/80 px-3 py-1 text-[11px] font-semibold text-muted shadow-[0_4px_12px_-8px_rgba(70,40,160,0.4)]">
                    {dayLabel(when)}
                  </span>
                </div>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-up`}>
                <div
                  className={`max-w-[82%] sm:max-w-[75%] px-4 py-2.5 text-sm leading-relaxed ${
                    mine
                      ? 'rounded-[20px] rounded-br-md bg-[image:var(--grad-brand)] text-white shadow-[0_12px_22px_-12px_rgba(106,43,234,0.65),inset_0_1px_0_rgba(255,255,255,0.3)]'
                      : 'rounded-[20px] rounded-bl-md border border-white bg-white/90 text-ink shadow-[0_10px_20px_-14px_rgba(70,40,160,0.45)]'
                  }`}
                >
                  <span className="block whitespace-pre-wrap break-words">{m.text}</span>
                  <span
                    className={`mt-1 flex items-center justify-end gap-1 text-[10.5px] font-medium ${
                      mine ? 'text-white/75' : 'text-muted'
                    }`}
                  >
                    <span>{m.sender === 'admin' ? 'Support' : 'You'}</span>
                    {when && <span>· {timeLabel(when)}</span>}
                    {mine &&
                      (seen ? (
                        <CheckCheck className="w-3.5 h-3.5" aria-label="Seen" />
                      ) : (
                        <Check className="w-3.5 h-3.5" aria-label="Sent" />
                      ))}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-line bg-white/55 p-3 sm:px-4"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          aria-label="Type a message"
          maxLength={2000}
          className="h-12 min-w-0 flex-1 rounded-full border border-line-strong bg-white/95 px-5 text-sm text-ink placeholder:text-faint shadow-[inset_0_1px_2px_rgba(70,40,160,0.05)] transition-[border-color,box-shadow] hover:border-brand-200 focus-visible:border-brand focus-visible:shadow-[0_0_0_4px_rgba(123,63,242,0.14)] focus-visible:outline-none"
        />
        <Button
          type="submit"
          variant="solid"
          size="icon"
          loading={sending}
          disabled={!text.trim()}
          aria-label="Send message"
          className="shrink-0 !h-12 !w-12"
        >
          {!sending && <Send className="h-[18px] w-[18px] translate-x-[-1px] translate-y-[1px]" />}
        </Button>
      </form>
    </div>
  );
}
