'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { HeroHeader } from '@/components/ui/dashboard-kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Megaphone, Plus, Trash2, Pin } from 'lucide-react';
import type { Notice } from '@/types';
import { formatDateIN, errorMessage, tsToDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function OwnerNoticesPage() {
  const { ownerId } = useOwnerSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notices');
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices || []);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [ownerId, load]);

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Add a title and message');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), audience, pinned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not publish');
      toast.success('Notice published');
      setTitle('');
      setBody('');
      setAudience('all');
      setPinned(false);
      setShowForm(false);
      load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not publish notice'));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      toast.success('Notice removed');
      setNotices((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast.error('Could not remove notice');
    }
  };

  const audienceLabel = (a: string) => (a === 'residents' ? 'Residents' : a === 'staff' ? 'Staff' : 'Everyone');

  return (
    <div className="space-y-4 text-left">
      <div className="-mx-4 -mt-4 sm:-mx-6 md:mx-0 md:mt-0">
        <HeroHeader
          eyebrow={<><Megaphone className="h-3 w-3" /> Notices</>}
          title="Announcements"
          subtitle="Post notices to your residents and staff"
          right={
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold accent-text shadow-sm press"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          }
        />
      </div>

      {showForm && (
        <section className="app-card p-4 space-y-3">
          <Input label="Title" placeholder="e.g. Water supply maintenance" value={title} onChange={(e) => setTitle(e.target.value)} disabled={posting} />
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-1 block">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={posting}
              rows={3}
              maxLength={2000}
              placeholder="Write the announcement…"
              className="w-full rounded-[12px] border border-[#E2E8F0] px-3.5 py-2 text-sm focus:border-[color:var(--accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 items-end">
            <Dropdown
              label="Audience"
              id="notice-audience"
              value={audience}
              onChange={setAudience}
              options={[
                { value: 'all', label: 'Everyone' },
                { value: 'residents', label: 'Residents only' },
                { value: 'staff', label: 'Staff only' },
              ]}
            />
            <button
              type="button"
              onClick={() => setPinned((p) => !p)}
              className={`h-11 inline-flex items-center justify-center gap-1.5 rounded-[12px] border text-xs font-semibold ${
                pinned ? 'border-[color:var(--accent)] accent-soft-bg' : 'border-[#E2E8F0] text-[#64748B]'
              }`}
            >
              <Pin className="h-3.5 w-3.5" /> {pinned ? 'Pinned' : 'Pin to top'}
            </button>
          </div>
          <Button size="sm" variant="solid" loading={posting} onClick={publish}>
            <Megaphone className="h-3.5 w-3.5 mr-1" /> Publish notice
          </Button>
        </section>
      )}

      {loading ? (
        <CardListSkeleton rows={3} height="h-24" />
      ) : notices.length === 0 ? (
        <div className="app-card p-6">
          <EmptyState
            icon={<Megaphone className="w-6 h-6 accent-text" />}
            title="No notices yet"
            description="Post your first announcement — residents and staff will see it in their app."
            action={
              <Button size="sm" variant="solid" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New notice
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="app-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.pinned && <Pin className="h-3.5 w-3.5 accent-text" />}
                    <h3 className="text-sm font-bold text-[#0F172A]">{n.title}</h3>
                    <span className="text-[10px] font-bold accent-text accent-soft-bg px-1.5 py-0.5 rounded">
                      {audienceLabel(n.audience)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#475569] whitespace-pre-wrap break-words">{n.body}</p>
                  <p className="mt-1.5 text-[11px] text-[#94A3B8]">
                    {formatDateIN(tsToDate(n.createdAt))}
                    {n.readBy && n.readBy.length > 0 ? ` · ${n.readBy.length} read` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="shrink-0 text-[#DC2626] hover:bg-[#FEF2F2] rounded-[8px] p-2"
                  aria-label="Delete notice"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
