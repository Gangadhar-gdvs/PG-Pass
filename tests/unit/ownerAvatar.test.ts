import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Owner profile picture service — upload verification + privacy rules.
 * `adminDb` and the storage provider are mocked; the real service logic runs.
 */

const ownerDocs: Record<string, Record<string, unknown>> = {};
const setSpy = vi.fn(async (id: string, data: Record<string, unknown>) => {
  ownerDocs[id] = { ...(ownerDocs[id] || {}), ...data };
});

vi.mock('@/lib/server/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: Boolean(ownerDocs[id]), data: () => ownerDocs[id] }),
        set: (data: Record<string, unknown>) => setSpy(id, data),
      }),
    }),
  },
}));

const storage = {
  mintPresignedPut: vi.fn(async () => 'https://storage.test/put'),
  mintPresignedGet: vi.fn(async (_b: string, key: string) => `https://storage.test/get/${key}`),
  headObject: vi.fn(async () => ({ contentLength: 20_000, contentType: 'image/webp' })),
  streamAndVerify: vi.fn(async () => ({ contentLength: 20_000, sha256: 'x', magicValid: true })),
  copyObject: vi.fn(async () => {}),
  deleteObject: vi.fn(async () => {}),
};
vi.mock('@/lib/server/storage/provider', () => ({ storageProvider: storage }));

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const pendingKey = (owner: string) => `pending/${owner}/avatar/${UUID}.webp`;

beforeEach(() => {
  for (const k of Object.keys(ownerDocs)) delete ownerDocs[k];
  ownerDocs.ownerA = { name: 'A' };
  Object.values(storage).forEach((f) => f.mockClear());
  setSpy.mockClear();
  storage.headObject.mockResolvedValue({ contentLength: 20_000, contentType: 'image/webp' });
  storage.streamAndVerify.mockResolvedValue({ contentLength: 20_000, sha256: 'x', magicValid: true });
});

describe('ownerAvatarService', () => {
  it('only issues upload URLs for small WebP/JPEG images, into the owner’s pending buffer', async () => {
    const { ownerAvatarService } = await import('@/lib/server/services/ownerAvatar.service');
    await expect(ownerAvatarService.createUploadIntent('ownerA', 'image/png', 1000)).rejects.toMatchObject({ statusCode: 400 });
    await expect(ownerAvatarService.createUploadIntent('ownerA', 'image/webp', 2_000_000)).rejects.toMatchObject({ statusCode: 400 });
    const res = await ownerAvatarService.createUploadIntent('ownerA', 'image/webp', 50_000);
    expect(res.objectKey).toMatch(/^pending\/ownerA\/avatar\/[0-9a-f-]{36}\.webp$/);
  });

  it('rejects confirming another owner’s object or a path-traversal key (403)', async () => {
    const { ownerAvatarService } = await import('@/lib/server/services/ownerAvatar.service');
    await expect(ownerAvatarService.confirmUpload('ownerA', pendingKey('ownerB'))).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      ownerAvatarService.confirmUpload('ownerA', `pending/ownerA/avatar/../../ownerB/avatar/${UUID}.webp`)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(storage.copyObject).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('deletes and rejects files that fail the magic-byte check (422)', async () => {
    const { ownerAvatarService } = await import('@/lib/server/services/ownerAvatar.service');
    storage.streamAndVerify.mockResolvedValueOnce({ contentLength: 20_000, sha256: 'x', magicValid: false });
    await expect(ownerAvatarService.confirmUpload('ownerA', pendingKey('ownerA'))).rejects.toMatchObject({ statusCode: 422 });
    expect(storage.deleteObject).toHaveBeenCalledWith(expect.any(String), pendingKey('ownerA'));
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('rejects oversized uploads even if the client lied about the size', async () => {
    const { ownerAvatarService } = await import('@/lib/server/services/ownerAvatar.service');
    storage.headObject.mockResolvedValueOnce({ contentLength: 5_000_000, contentType: 'image/webp' });
    await expect(ownerAvatarService.confirmUpload('ownerA', pendingKey('ownerA'))).rejects.toMatchObject({ statusCode: 400 });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('moves a verified upload to private storage, saves the key and deletes the previous picture', async () => {
    const { ownerAvatarService } = await import('@/lib/server/services/ownerAvatar.service');
    ownerDocs.ownerA.avatarKey = 'avatar/ownerA/old.webp';
    const { url } = await ownerAvatarService.confirmUpload('ownerA', pendingKey('ownerA'));

    const dest = `avatar/ownerA/${UUID}.webp`;
    expect(storage.copyObject).toHaveBeenCalledWith(expect.any(String), pendingKey('ownerA'), dest);
    expect(ownerDocs.ownerA.avatarKey).toBe(dest);
    expect(storage.deleteObject).toHaveBeenCalledWith(expect.any(String), 'avatar/ownerA/old.webp');
    expect(url).toBe(`https://storage.test/get/${dest}`);
  });

  it('serves only short-lived URLs for the owner’s own key, and null when unset or foreign', async () => {
    const { ownerAvatarService } = await import('@/lib/server/services/ownerAvatar.service');
    expect(await ownerAvatarService.getViewUrl('ownerA')).toBeNull();
    ownerDocs.ownerA.avatarKey = 'avatar/ownerB/x.webp'; // tampered / foreign key
    expect(await ownerAvatarService.getViewUrl('ownerA')).toBeNull();
    ownerDocs.ownerA.avatarKey = 'avatar/ownerA/x.webp';
    expect(await ownerAvatarService.getViewUrl('ownerA')).toBe('https://storage.test/get/avatar/ownerA/x.webp');
  });

  it('remove clears the field and deletes the object', async () => {
    const { ownerAvatarService } = await import('@/lib/server/services/ownerAvatar.service');
    ownerDocs.ownerA.avatarKey = 'avatar/ownerA/x.webp';
    await ownerAvatarService.remove('ownerA');
    expect(ownerDocs.ownerA.avatarKey).toBeNull();
    expect(storage.deleteObject).toHaveBeenCalledWith(expect.any(String), 'avatar/ownerA/x.webp');
  });
});
