'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useAsyncData, fetchJson } from '@/hooks/useAsyncData';
import { apiPost, apiPatch, apiDelete } from '@/lib/client/api';
import { LoadError } from '@/components/ui/load-error';
import { PageHeader, SectionCard, StatTile } from '@/components/ui/dashboard-kit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { ListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Check, Trash2, CalendarDays, UserRound } from 'lucide-react';
import type { StaffTask } from '@/types';
import { formatDateIN, errorMessage, tsToDate, todayIST } from '@/lib/utils';
import toast from 'react-hot-toast';

interface StaffLite {
  id: string;
  name: string;
}

/** Today in IST (YYYY-MM-DD) — due dates are IST calendar dates. */
function localToday(): string {
  return todayIST();
}

export default function OwnerTasksPage() {
  const { ownerId, role } = useOwnerSession();
  const isStaff = role === 'staff';
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [today] = useState(localToday);

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [posting, setPosting] = useState(false);

  // Loads via the shared hook: a failed load now surfaces an error + Retry
  // instead of silently rendering an empty page. `staff` is only fetched for
  // owners (staff can't assign) and a staff-list failure is non-fatal to tasks.
  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const tasksP = fetchJson<{ tasks?: StaffTask[] }>('/api/tasks');
      const staffP = isStaff
        ? Promise.resolve({ staff: [] as StaffLite[] })
        : fetchJson<{ staff?: StaffLite[] }>('/api/staff').catch(() => ({ staff: [] as StaffLite[] }));
      const [t, s] = await Promise.all([tasksP, staffP]);
      return {
        tasks: t.tasks || [],
        staff: (s.staff || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })),
      };
    },
    [ownerId, isStaff],
    { enabled: !!ownerId }
  );

  // Optimistic overlay: handlers patch status/removal locally for snappy UX; the
  // overlay is reconciled against server data on the next reload. Keyed by task id.
  const [overlay, setOverlay] = useState<Record<string, StaffTask['status'] | 'removed'>>({});

  const staff = data?.staff ?? [];
  const tasks = (data?.tasks ?? [])
    .filter((t) => overlay[t.id] !== 'removed')
    .map((t) => {
      const o = overlay[t.id];
      return o && o !== 'removed' ? { ...t, status: o } : t;
    });

  const reloadAndClear = () => {
    setOverlay({});
    reload();
  };
  const load = reloadAndClear;

  const addTask = async () => {
    if (!title.trim()) {
      toast.error('Enter a task title');
      return;
    }
    setPosting(true);
    try {
      const chosen = staff.find((s) => s.id === assignee);
      await apiPost('/api/tasks', {
        title: title.trim(),
        note: note.trim() || undefined,
        assignedToUid: assignee || undefined,
        assignedToName: chosen?.name,
        dueDate: dueDate || undefined,
      });
      toast.success('Task added');
      setTitle('');
      setNote('');
      setAssignee('');
      setDueDate('');
      setShowForm(false);
      load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not add task'));
    } finally {
      setPosting(false);
    }
  };

  const toggle = async (t: StaffTask) => {
    setBusyId(t.id);
    try {
      const next = t.status === 'done' ? 'open' : 'done';
      await apiPatch(`/api/tasks/${t.id}`, { status: next });
      setOverlay((prev) => ({ ...prev, [t.id]: next }));
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not update task'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiDelete(`/api/tasks/${id}`);
      setOverlay((prev) => ({ ...prev, [id]: 'removed' }));
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not remove task'));
    }
  };

  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const overdueCount = open.filter((t) => t.dueDate && t.dueDate < today).length;

  return (
    <div className="space-y-5 text-left">
      <PageHeader
        icon="doc-green"
        tint="mint"
        title={isStaff ? 'My Tasks' : 'Staff Tasks'}
        subtitle={isStaff ? 'Your assigned and general tasks' : 'Assign and track work for your staff'}
        actions={
          !isStaff ? (
            <Button onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
              <Plus className="h-4 w-4" /> New task
            </Button>
          ) : undefined
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
          <StatTile icon="clock" tint="violet" label="To Do" value={open.length} />
          <StatTile icon="alert" tint="peach" label="Overdue" value={overdueCount} />
          <StatTile icon="check" tint="mint" label="Completed" value={done.length} />
          <StatTile icon="doc-green" tint="sky" label="Total Tasks" value={tasks.length} />
        </div>
      )}

      {showForm && !isStaff && (
        <SectionCard title="New task" icon="doc-green" className="animate-pop" bodyClassName="space-y-4">
          <Input
            label="Task"
            placeholder="e.g. Clean 2nd floor common area"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={posting}
          />
          <Input
            label="Note (optional)"
            placeholder="Any detail"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={posting}
          />
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
            <Dropdown
              label="Assign to"
              id="task-assignee"
              value={assignee}
              onChange={setAssignee}
              options={[{ value: '', label: 'Any staff (general)' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={posting} />
          </div>
          <div className="flex justify-end">
            <Button variant="solid" loading={posting} onClick={addTask} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Add task
            </Button>
          </div>
        </SectionCard>
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : tasks.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="doc-green"
            title={isStaff ? 'No tasks assigned' : 'No tasks yet'}
            description={isStaff ? 'Tasks your owner assigns will appear here.' : 'Add a task to assign work to your staff.'}
            action={
              !isStaff ? (
                <Button variant="solid" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4" /> New task
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {open.length > 0 && (
            <SectionCard
              title="To do"
              icon="clock"
              action={<span className="chip font-mono-numbers">{open.length}</span>}
            >
              <ul className="divide-y divide-line stagger">
                {open.map((t) => (
                  <TaskRow key={t.id} t={t} today={today} busy={busyId === t.id} onToggle={() => toggle(t)} onRemove={!isStaff ? () => remove(t.id) : undefined} />
                ))}
              </ul>
            </SectionCard>
          )}
          {done.length > 0 && (
            <SectionCard
              title="Completed"
              icon="check"
              action={<span className="chip font-mono-numbers">{done.length}</span>}
            >
              <ul className="divide-y divide-line stagger">
                {done.map((t) => (
                  <TaskRow key={t.id} t={t} today={today} busy={busyId === t.id} onToggle={() => toggle(t)} onRemove={!isStaff ? () => remove(t.id) : undefined} />
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}

function TaskRow({
  t,
  today,
  busy,
  onToggle,
  onRemove,
}: {
  t: StaffTask;
  today: string;
  busy: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const done = t.status === 'done';
  const overdue = !done && t.dueDate ? t.dueDate < today : false;
  const dueToday = !done && t.dueDate === today;
  return (
    <li className="flex items-center gap-2 py-2.5 first:pt-0.5 last:pb-0.5">
      {/* Round checkbox — 44px hit area around a 28px violet circle. */}
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="group -ml-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50 press"
        aria-label={done ? 'Mark open' : 'Mark done'}
      >
        <span
          className={`grid h-7 w-7 place-items-center rounded-full transition-all ${
            done
              ? 'bg-[image:var(--grad-brand)] text-white shadow-[var(--shadow-brand)]'
              : 'border-2 border-brand-300 bg-white text-transparent group-hover:border-brand group-hover:text-brand-300'
          }`}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={`text-[14.5px] font-bold leading-snug break-words ${
            done ? 'text-muted line-through decoration-brand-300' : 'text-ink'
          }`}
        >
          {t.title}
        </div>
        {t.note && <div className="truncate text-[12.5px] font-medium text-muted">{t.note}</div>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral">
            <UserRound className="h-3 w-3" />
            {t.assignedToName ? `${t.assignedToName}` : 'Any staff'}
          </Badge>
          {t.dueDate &&
            (overdue ? (
              <Badge variant="danger" className="font-mono-numbers">
                <CalendarDays className="h-3 w-3" /> Overdue · {formatDateIN(t.dueDate)}
              </Badge>
            ) : dueToday ? (
              <Badge variant="pending" className="font-mono-numbers">
                <CalendarDays className="h-3 w-3" /> Due today
              </Badge>
            ) : (
              <span className="chip font-mono-numbers">
                <CalendarDays className="h-3.5 w-3.5" /> Due {formatDateIN(t.dueDate)}
              </span>
            ))}
          {done && t.completedAt ? (
            <Badge variant="paid" className="font-mono-numbers">
              <Check className="h-3 w-3" strokeWidth={3} /> Done {formatDateIN(tsToDate(t.completedAt))}
            </Badge>
          ) : null}
        </div>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-danger-bg hover:text-danger press"
          aria-label="Delete task"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
