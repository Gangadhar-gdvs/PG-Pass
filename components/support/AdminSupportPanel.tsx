'use client';

import React, { useEffect, useState } from 'react';
import { subscribeToSupportThreads } from '@/lib/firestore';
import { SupportChat } from '@/components/support/SupportChat';
import { Avatar } from '@/components/ui/avatar';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import type { SupportThread } from '@/types';
import toast from 'react-hot-toast';

/**
 * Admin support console. Left: live list of EACH owner's own thread (never
 * merged — one row per owner). Right: the selected owner's conversation.
 * Everything streams via onSnapshot (push, no polling).
 */
export function AdminSupportPanel() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // Live thread list (admin rule allows listing all threads).
  useEffect(() => subscribeToSupportThreads(setThreads), []);

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
    <div className="flex-1 overflow-hidden">
      <div className="h-full max-w-6xl mx-auto w-full flex flex-col md:flex-row border border-[#E2E8F0] rounded-[12px] bg-white overflow-hidden shadow-xs">
        {/* Thread list — one row per owner, kept separate */}
        <aside
          className={`md:w-80 md:border-r border-[#E2E8F0] flex-col ${
            selected ? 'hidden md:flex' : 'flex'
          } w-full`}
        >
          <div className="p-3 border-b border-[#E2E8F0] text-xs font-bold text-[#09090B] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#4F46E5]" />
            Owner Conversations
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9]">
            {threads.length === 0 && (
              <div className="p-6 text-center text-xs text-[#94A3B8]">
                No owner has started a conversation yet.
              </div>
            )}
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelected(t.id);
                  markRead(t.id);
                }}
                className={`w-full text-left p-3 flex items-center gap-3 transition-colors cursor-pointer ${
                  selected === t.id ? 'bg-[#EEF2FF]' : 'hover:bg-[#F8FAFC]'
                }`}
              >
                <Avatar name={t.pgName || t.ownerName || 'PG'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-[#09090B] truncate">
                      {t.pgName || t.ownerName || 'PG Owner'}
                    </span>
                    {(t.unreadForAdmin ?? 0) > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] bg-[#DC2626] text-white font-bold">
                        {t.unreadForAdmin}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] truncate">
                    {t.lastSender === 'admin' ? 'You: ' : ''}
                    {t.lastMessage || 'No messages'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Conversation */}
        <section className={`flex-1 flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
          {current ? (
            <>
              <div className="p-3 border-b border-[#E2E8F0] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="md:hidden p-1 -ml-1 text-[#64748B] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <Avatar name={current.pgName || current.ownerName || 'PG'} size="sm" />
                <div className="min-w-0">
                  <div className="font-bold text-xs text-[#09090B] truncate">
                    {current.pgName || 'PG Owner'}
                  </div>
                  <div className="text-[10px] text-[#64748B] truncate">{current.ownerName}</div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden theme-admin">
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
            <div className="flex-1 hidden md:flex items-center justify-center text-xs text-[#94A3B8]">
              Select an owner conversation to reply.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
