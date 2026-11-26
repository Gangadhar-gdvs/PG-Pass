import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { StaffTask, StaffTaskStatus } from '@/types';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import { Timestamp } from 'firebase-admin/firestore';

export class TasksService {
  /** Owner creates/assigns a task. */
  async create(params: {
    ownerId: string;
    title: string;
    note?: string;
    assignedToUid?: string;
    assignedToName?: string;
    dueDate?: string;
    createdBy: string;
  }): Promise<StaffTask> {
    const title = params.title.trim().slice(0, 140);
    if (title.length < 2) throw new AppError(400, 'Please enter a task title');

    const ref = adminDb.collection('staff_tasks').doc();
    const now = Timestamp.now();
    const task: StaffTask = {
      id: ref.id,
      ownerId: params.ownerId,
      propertyId: params.ownerId,
      title,
      note: params.note?.trim().slice(0, 500) || undefined,
      assignedToUid: params.assignedToUid || undefined,
      assignedToName: params.assignedToName || undefined,
      dueDate: params.dueDate || undefined,
      status: 'open',
      createdBy: params.createdBy,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(task);
    return task;
  }

  /**
   * Tasks for the owner view (all) or a staff view (assigned to them OR
   * unassigned/general). Newest first; excludes soft-deleted.
   */
  async list(
    ownerId: string,
    opts: { forStaffUid?: string; status?: StaffTaskStatus } = {},
    limitCount = 100
  ): Promise<StaffTask[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    const snap = await adminDb
      .collection('staff_tasks')
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .limit(safeLimit)
      .get();
    let tasks = snap.docs.map((d) => ({ ...d.data(), id: d.id } as StaffTask)).filter((t) => !t.deletedAt);
    if (opts.forStaffUid) {
      tasks = tasks.filter((t) => !t.assignedToUid || t.assignedToUid === opts.forStaffUid);
    }
    if (opts.status) tasks = tasks.filter((t) => t.status === opts.status);
    return tasks;
  }

  /** Mark a task done/open. Owner or any staff of the PG may complete. */
  async setStatus(
    taskId: string,
    ownerId: string,
    status: StaffTaskStatus,
    actorUid: string
  ): Promise<StaffTask> {
    const ref = adminDb.collection('staff_tasks').doc(taskId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Task not found');
    const data = snap.data() as StaffTask;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');

    const now = Timestamp.now();
    const update: Partial<StaffTask> = { status, updatedAt: now };
    if (status === 'done') {
      update.completedBy = actorUid;
      update.completedAt = now;
    } else {
      update.completedBy = undefined;
      update.completedAt = null as unknown as undefined;
    }
    await ref.update(update);
    return { ...data, ...update, id: taskId };
  }

  /** Owner soft-deletes a task. */
  async softDelete(taskId: string, ownerId: string): Promise<void> {
    const ref = adminDb.collection('staff_tasks').doc(taskId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Task not found');
    if ((snap.data() as StaffTask).ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    await ref.update({ deletedAt: Timestamp.now(), updatedAt: Timestamp.now() });
  }
}

export const tasksService = new TasksService();
