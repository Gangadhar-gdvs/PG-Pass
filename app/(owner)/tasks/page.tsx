'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { HeroHeader } from '@/components/ui/dashboard-kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardList, Plus, Check, Trash2, CircleDashed } from 'lucide-react';
import type { StaffTask } from '@/types';
import { formatDateIN, errorMessage, tsToDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface StaffLite {
  id: string;
  name: string;
}

export default function OwnerTasksPage() {
  const { ownerId, role } = useOwnerSession();
  const isStaff = role === 'staff';
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [staff, setStaff] = useState<StaffLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reqs: Promise<Response>[] = [fetch('/api/tasks')];
      if (!isStaff) reqs.push(fetch('/api/staff'));
      const [tRes, sRes] = await Promise.all(reqs);
      if (tRes.ok) setTasks((await tRes.json()).tasks || []);
      if (sRes && sRes.ok) {
        const sd = await sRes.json();
        setStaff((sd.staff || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

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

  const addTask = async () => {
    if (!title.trim()) {
      toast.error('Enter a task title');
      return;
    }
    setPosting(true);
    try {
      const chosen = staff.find((s) => s.id === assignee);
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          note: note.trim() || undefined,
          assignedToUid: assignee || undefined,
          assignedToName: chosen?.name,
          dueDate: dueDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add task');
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
      const res = await fetch(`/api/tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('failed');
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    } catch {
      toast.error('Could not update task');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      setTasks((prev) => prev.filter((x) => x.id !== id));
    } catch {
      toast.error('Could not remove task');
    }
  };

  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-4 text-left">
      <div className="-mx-4 -mt-4 sm:-mx-6 md:mx-0 md:mt-0">
        <HeroHeader
          eyebrow={<><ClipboardList className="h-3 w-3" /> Tasks</>}
          title={isStaff ? 'My Tasks' : 'Staff Tasks'}
          subtitle={isStaff ? 'Your assigned and general tasks' : 'Assign and track work for your staff'}
          right={
            !isStaff ? (
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold accent-text shadow-sm press"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </button>
            ) : undefined
          }
        />
      </div>

      {showForm && !isStaff && (
        <section className="app-card p-4 space-y-3">
          <Input label="Task" placeholder="e.g. Clean 2nd floor common area" value={title} onChange={(e) => setTitle(e.target.value)} disabled={posting} />
          <Input label="Note (optional)" placeholder="Any detail" value={note} onChange={(e) => setNote(e.target.value)} disabled={posting} />
          <div className="grid grid-cols-2 gap-2">
            <Dropdown
              label="Assign to"
              id="task-assignee"
              value={assignee}
              onChange={setAssignee}
              options={[{ value: '', label: 'Any staff (general)' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={posting} />
          </div>
          <Button size="sm" variant="solid" loading={posting} onClick={addTask}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add task
          </Button>
        </section>
      )}

      {loading ? (
        <CardListSkeleton rows={3} height="h-16" />
      ) : tasks.length === 0 ? (
        <div className="app-card p-6">
          <EmptyState
            icon={<ClipboardList className="w-6 h-6 accent-text" />}
            title={isStaff ? 'No tasks assigned' : 'No tasks yet'}
            description={isStaff ? 'Tasks your owner assigns will appear here.' : 'Add a task to assign work to your staff.'}
            action={!isStaff ? <Button size="sm" variant="solid" onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> New task</Button> : undefined}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {open.length > 0 && (
            <div className="space-y-2">
              {open.map((t) => (
                <TaskRow key={t.id} t={t} busy={busyId === t.id} onToggle={() => toggle(t)} onRemove={!isStaff ? () => remove(t.id) : undefined} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] px-1">Completed</h2>
              {done.map((t) => (
                <TaskRow key={t.id} t={t} busy={busyId === t.id} onToggle={() => toggle(t)} onRemove={!isStaff ? () => remove(t.id) : undefined} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  t,
  busy,
  onToggle,
  onRemove,
}: {
  t: StaffTask;
  busy: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const done = t.status === 'done';
  return (
    <div className={`app-card p-3.5 flex items-center gap-3 ${done ? 'opacity-70' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center border-2 ${
          done ? 'accent-bg border-transparent text-white' : 'border-[#CBD5E1] text-transparent'
        }`}
        aria-label={done ? 'Mark open' : 'Mark done'}
      >
        {done ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4 text-[#CBD5E1]" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold text-[#0F172A] ${done ? 'line-through' : ''}`}>{t.title}</div>
        {t.note && <div className="text-[11px] text-[#64748B] truncate">{t.note}</div>}
        <div className="text-[11px] text-[#94A3B8] mt-0.5">
          {t.assignedToName ? `${t.assignedToName}` : 'Any staff'}
          {t.dueDate ? ` · due ${formatDateIN(t.dueDate)}` : ''}
          {done && t.completedAt ? ` · done ${formatDateIN(tsToDate(t.completedAt))}` : ''}
        </div>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} className="shrink-0 text-[#DC2626] hover:bg-[#FEF2F2] rounded-[8px] p-2" aria-label="Delete task">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
