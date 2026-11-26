import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tenant-isolation INTEGRATION test (dependency-free). The app enforces isolation
 * in the SERVICE layer (Admin SDK bypasses Firestore rules), so we mock `adminDb`
 * to return a doc owned by OWNER A and assert the service rejects OWNER B. This
 * exercises the real `data.ownerId !== ownerId → 403` guards that protect every
 * id-addressed mutation (notices/tasks/visitors/tenants/…).
 */

// A tiny fake Firestore doc ref whose .get() returns a fixed doc, and whose
// .update() records calls. Shared across the mock below.
const updateSpy = vi.fn();
function fakeDoc(data: Record<string, unknown> | null) {
  return {
    get: async () => ({ exists: data !== null, data: () => data }),
    update: updateSpy,
  };
}

// The doc the "collection().doc()" returns is swapped per-test.
let currentDoc = fakeDoc(null);

vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => currentDoc,
    }),
  },
}));

// systemLogs.recordEvent is a no-op dependency for these services.
vi.mock('@/lib/server/services/systemLogs.service', () => ({
  recordEvent: async () => {},
}));

beforeEach(() => {
  updateSpy.mockReset();
});

describe('Service-layer tenant isolation', () => {
  it('notices.softDelete rejects a different owner (403)', async () => {
    const { noticesService } = await import('@/lib/server/services/notices.service');
    currentDoc = fakeDoc({ ownerId: 'ownerA', title: 'Hi' });

    // Owner B must NOT be able to delete owner A's notice.
    await expect(noticesService.softDelete('notice1', 'ownerB')).rejects.toMatchObject({ statusCode: 403 });
    expect(updateSpy).not.toHaveBeenCalled();

    // Owner A succeeds.
    await expect(noticesService.softDelete('notice1', 'ownerA')).resolves.toBeUndefined();
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('notices.markRead rejects a different owner (403)', async () => {
    const { noticesService } = await import('@/lib/server/services/notices.service');
    currentDoc = fakeDoc({ ownerId: 'ownerA', readBy: [] });
    await expect(noticesService.markRead('n1', 'ownerB', 'viewer')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('tasks.setStatus rejects a different owner (403)', async () => {
    const { tasksService } = await import('@/lib/server/services/tasks.service');
    currentDoc = fakeDoc({ ownerId: 'ownerA', status: 'open' });
    await expect(tasksService.setStatus('t1', 'ownerB', 'done', 'actor')).rejects.toMatchObject({ statusCode: 403 });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('visitors.checkOut rejects a different owner (403)', async () => {
    const { visitorsService } = await import('@/lib/server/services/visitors.service');
    currentDoc = fakeDoc({ ownerId: 'ownerA', status: 'in' });
    await expect(visitorsService.checkOut('v1', 'ownerB')).rejects.toMatchObject({ statusCode: 403 });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('a missing doc returns 404, not a silent pass', async () => {
    const { tasksService } = await import('@/lib/server/services/tasks.service');
    currentDoc = fakeDoc(null);
    await expect(tasksService.setStatus('gone', 'ownerA', 'done', 'actor')).rejects.toMatchObject({ statusCode: 404 });
  });
});
