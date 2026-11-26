'use client';

import React, { useEffect, useState } from 'react';
import { subscribeToSupportThreads } from '@/lib/firestore';
import { SupportChat } from '@/components/support/SupportChat';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader, InfoBanner } from '@/components/ui/dashboard-kit';
import { GlyphTile } from '@/components/brand/Icon3D';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import type { SupportThread } from '@/types';
import toast from 'react-hot-toast';

/**
 * Admin support console. Left: live list of EACH owner's own thread (never
 * merged — one row per owner). Right: the selected owner's conversation.
 * Everything streams via onSnapshot (push, no polling).
 *
 * Layout: two glass cards side by side on md+; on phones only one shows at a
 * time (list, or the open conversation with a back button).
 */
export function AdminSupportPanel() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Live thread list (admin rule allows listing all threads).
  useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
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
    const unsub = subscribeToSupportThreads(
      (t) => {
        settled = true;
        clearTimeout(timeout);
        setThreads(t);
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
  }, []);

  const current = threads.find((t) => t.id === selected) || null;

  const markRead = (ownerId: string) => {
    fetch('/api/admin/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, markRead: true }),
    }).catch(() => {});
  };

  const send = async (ownerId: string, text: string) => {
    const res = await fetch('/api/admin/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || 'Could not send reply');
      throw new Error('send failed');
    }
  };

  return (
    <div className="grid h-[calc(100dvh-16.5rem)] min-h-[440px] w-full gap-4 md:h-[calc(100dvh-15rem)] md:min-h-[540px] md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Thread list — one row per owner, kept separate */}
      <aside className={`app-card min-h-0 flex-col p-3 sm:p-4 ${selected ? 'hidden md:flex' : 'flex'}`}>
        <SectionHeader
          title="Owner conversations"
          icon={<GlyphTile icon={MessageSquare} size={30} />}
          action={
            !loading && !error && threads.length > 0 ? (
              <span className="chip shrink-0 font-mono-numbers">{threads.length}</span>
            ) : undefined
          }
          className="px-1"
        />
        <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {loading && (
            <div className="space-y-1 py-1" aria-label="Loading conversations">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2.5 py-2.5">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-2/3 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && error && (
            <InfoBanner
              tone="danger"
              title="Couldn't load conversations."
              description="Check your connection and try again."
            />
          )}
          {!loading && !error && threads.length === 0 && (
            <EmptyState
              icon3d="bell-purple"
              title="No conversations yet"
              description="No owner has started a conversation yet."
              className="py-8"
            />
          )}
          {!loading &&
            threads.map((t) => {
              const isActive = selected === t.id;
              const unread = t.unreadForAdmin ?? 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    setSelected(t.id);
                    markRead(t.id);
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors press ${
                    isActive ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-lilac'
                  }`}
                >
                  <Avatar name={t.pgName || t.ownerName || 'PG'} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[14px] text-ink ${unread > 0 ? 'font-extrabold' : 'font-bold'}`}>
                        {t.pgName || t.ownerName || 'PG Owner'}
                      </span>
                      {unread > 0 && (
                        <span
                          className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white font-mono-numbers"
                          aria-label={`${unread} unread`}
                        >
                          {t.unreadForAdmin}
                        </span>
                      )}
                    </div>
                    <p className={`truncate text-[12.5px] ${unread > 0 ? 'font-semibold text-ink-2' : 'font-medium text-muted'}`}>
                      {t.lastSender === 'admin' ? 'You: ' : ''}
                      {t.lastMessage || 'No messages'}
                    </p>
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      {/* Conversation */}
      <section className={`app-card min-h-0 flex-col overflow-hidden ${selected ? 'flex' : 'hidden md:flex'}`}>
        {current ? (
          <>
            <div className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-4">
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Back to conversations"
                className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-ink-2 shadow-[0_6px_14px_-8px_rgba(70,40,160,0.4)] press md:hidden"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
              <Avatar name={current.pgName || current.ownerName || 'PG'} size="md" />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-extrabold tracking-[-0.01em] text-ink">
                  {current.pgName || 'PG Owner'}
                </div>
                <div className="truncate text-[12.5px] font-medium text-muted">{current.ownerName}</div>
              </div>
            </div>
            <div className="theme-admin min-h-0 flex-1 overflow-hidden bg-lilac/40">
              <SupportChat
                threadOwnerId={current.id}
                viewerSide="admin"
                onSend={(text) => send(current.id, text)}
                onOpen={() => markRead(current.id)}
                emptyHint="No messages in this conversation yet."
              />
            </div>
          </>
        ) : (
          <div className="hidden flex-1 items-center justify-center md:flex">
            <EmptyState
              icon3d="bell-purple"
              title="No conversation open"
              description="Select an owner conversation to reply."
            />
          </div>
        )}
      </section>
    </div>
  );
}
