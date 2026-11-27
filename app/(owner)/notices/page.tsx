'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useAsyncData, fetchJson } from '@/hooks/useAsyncData';
import { apiPost, apiDelete } from '@/lib/client/api';
import { LoadError } from '@/components/ui/load-error';
import { PageHeader, SectionCard, StatTile } from '@/components/ui/dashboard-kit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { CardListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBubble } from '@/components/brand/Icon3D';
import { Megaphone, Plus, Trash2, Pin, CalendarDays, Eye, Users } from 'lucide-react';
import type { Notice } from '@/types';
import { formatDateIN, errorMessage, tsToDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function OwnerNoticesPage() {
  const { ownerId } = useOwnerSession();
  const [showForm, setShowForm] = useState(false);

  // form
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  // Loads through the shared hook so a failed load shows an error + Retry instead
  // of a silently-empty notices page.
  const { data, loading, error, reload } = useAsyncData(
    () => fetchJson<{ notices?: Notice[] }>('/api/notices'),
    [ownerId],
    { enabled: !!ownerId }
  );
  const load = () => {
    setRemoved(new Set());
    reload();
  };
  const notices = (data?.notices ?? []).filter((n) => !removed.has(n.id));

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Add a title and message');
      return;
    }
    setPosting(true);
    try {
      await apiPost('/api/notices', { title: title.trim(), body: body.trim(), audience, pinned });
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
      await apiDelete(`/api/notices/${id}`);
      toast.success('Notice removed');
      setRemoved((prev) => new Set(prev).add(id));
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not remove notice'));
    }
  };

  const audienceLabel = (a: string) => (a === 'residents' ? 'Residents' : a === 'staff' ? 'Staff' : 'Everyone');

  // Display-only totals of the notices already loaded.
  const pinnedCount = notices.filter((n) => n.pinned).length;
  const totalReads = notices.reduce((sum, n) => sum + (n.readBy?.length || 0), 0);
  const forResidents = notices.filter((n) => n.audience !== 'staff').length;

  return (
    <div className="space-y-5 text-left">
      <PageHeader
        icon="megaphone"
        tint="violet"
        title="Announcements"
        subtitle="Post notices to your residents and staff"
        actions={
          <Button onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
            <Plus className="h-4 w-4" /> New notice
          </Button>
        }
      />

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (
        <>
      {loading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <StatTile icon="megaphone" tint="violet" label="Published" value={notices.length} />
          <StatTile icon="star" tint="amber" label="Pinned" value={pinnedCount} />
          <StatTile icon="users" tint="sky" label="For Residents" value={forResidents} />
          <StatTile icon="check" tint="mint" label="Total Reads" value={totalReads} />
        </div>
      )}

      {showForm && (
        <SectionCard title="New announcement" icon="megaphone" className="animate-pop" bodyClassName="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Water supply maintenance"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={posting}
          />
          <Textarea
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={posting}
            rows={3}
            maxLength={2000}
            placeholder="Write the announcement…"
            helperText={`${body.length}/2000`}
          />
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 items-end">
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
              aria-pressed={pinned}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border text-[13px] font-bold transition-colors press ${
                pinned
                  ? 'border-brand-200 bg-brand-100 text-brand-700'
                  : 'border-line-strong bg-white/90 text-ink-2 hover:border-brand-200 hover:text-brand-700'
              }`}
            >
              <Pin className={`h-4 w-4 ${pinned ? 'fill-current' : ''}`} /> {pinned ? 'Pinned' : 'Pin to top'}
            </button>
          </div>
          <div className="flex justify-end">
            <Button variant="solid" loading={posting} onClick={publish} className="w-full sm:w-auto">
              <Megaphone className="h-4 w-4" /> Publish notice
            </Button>
          </div>
        </SectionCard>
      )}

      {loading ? (
        <CardListSkeleton rows={4} height="h-36" cols={2} />
      ) : notices.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="megaphone"
            title="No notices yet"
            description="Post your first announcement — residents and staff will see it in their app."
            action={
              <Button variant="solid" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> New notice
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start stagger">
          {notices.map((n) => {
            const posted = formatDateIN(tsToDate(n.createdAt));
            const reads = n.readBy?.length || 0;
            return (
              <article
                key={n.id}
                className={`app-card p-4 sm:p-5 ${n.pinned ? 'ring-1 ring-brand-200' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <IconBubble icon="megaphone" tint="violet" size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="pt-0.5 text-[15px] font-bold leading-snug text-ink break-words">{n.title}</h3>
                      <button
                        type="button"
                        onClick={() => remove(n.id)}
                        className="-mr-1.5 -mt-1.5 inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-danger-bg hover:text-danger press"
                        aria-label="Delete notice"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {n.pinned && (
                        <Badge variant="brand">
                          <Pin className="h-3 w-3 fill-current" /> Pinned
                        </Badge>
                      )}
                      <Badge variant="cyan">
                        <Users className="h-3 w-3" /> {audienceLabel(n.audience)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words">{n.body}</p>

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {posted && (
                    <span className="chip font-mono-numbers">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {posted}
                    </span>
                  )}
                  {reads > 0 && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted">
                      <Eye className="h-3.5 w-3.5" /> {reads} read
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}
