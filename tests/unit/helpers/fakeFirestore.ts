/**
 * Minimal in-memory Firestore for service-layer unit tests. Supports the
 * surface the services use: collection().doc().get/set/update, where('==')
 * queries with orderBy/limit, runTransaction (tx.get on refs + queries,
 * tx.getAll, buffered tx.set/update applied on commit) and batch().
 *
 * Semantics mirrored from Firestore where it matters for business rules:
 *  - `where(f, '==', null)` matches only an explicit null (a missing field
 *    does NOT match), like the real backend.
 *  - transaction writes become visible only after the callback resolves; a
 *    throw discards them (atomicity).
 */

type Data = Record<string, unknown>;

function clone<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => clone(x)) as unknown as T;
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Data = {};
    for (const [k, val] of Object.entries(v as Data)) out[k] = clone(val);
    return out as T;
  }
  return v; // primitives + class instances (e.g. Timestamp) by reference
}

function stripUndefined(d: Data): Data {
  const out: Data = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) out[k] = v;
  return out;
}

function sortValue(v: unknown): number | string {
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: unknown }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return v as number | string;
}

export class FakeDb {
  store = new Map<string, Map<string, Data>>();
  private seq = 0;
  writes = 0;

  col(name: string): Map<string, Data> {
    if (!this.store.has(name)) this.store.set(name, new Map());
    return this.store.get(name)!;
  }

  // ----- test helpers -----
  reset() {
    this.store.clear();
    this.seq = 0;
    this.writes = 0;
  }
  seed(collection: string, id: string, data: Data) {
    this.col(collection).set(id, clone(data));
  }
  read(collection: string, id: string): Data | undefined {
    const d = this.col(collection).get(id);
    return d ? clone(d) : undefined;
  }
  all(collection: string): Data[] {
    return Array.from(this.col(collection).values()).map((d) => clone(d));
  }
  nextId() {
    this.seq += 1;
    return `auto${this.seq}`;
  }

  // ----- Firestore-like API -----
  collection(name: string) {
    return new FakeCollection(this, name);
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this);
    const out = await fn(tx);
    tx.commit();
    return out;
  }

  batch() {
    const ops: Array<() => void> = [];
    return {
      set: (ref: FakeDocRef, data: Data) => ops.push(() => ref.setSync(data)),
      update: (ref: FakeDocRef, data: Data) => ops.push(() => ref.updateSync(data)),
      delete: (ref: FakeDocRef) => ops.push(() => ref.deleteSync()),
      commit: async () => ops.forEach((op) => op()),
    };
  }
}

export class FakeSnapshot {
  constructor(
    public ref: FakeDocRef,
    private value: Data | undefined
  ) {}
  get id() {
    return this.ref.id;
  }
  get exists() {
    return this.value !== undefined;
  }
  data() {
    return this.value ? clone(this.value) : undefined;
  }
}

export class FakeDocRef {
  constructor(
    private db: FakeDb,
    public collectionName: string,
    public id: string
  ) {}
  snapshot() {
    return new FakeSnapshot(this, this.db.col(this.collectionName).get(this.id));
  }
  async get() {
    return this.snapshot();
  }
  setSync(data: Data, opts?: { merge?: boolean }) {
    const c = this.db.col(this.collectionName);
    const prev = opts?.merge ? c.get(this.id) || {} : {};
    c.set(this.id, clone({ ...prev, ...stripUndefined(data) }));
    this.db.writes++;
  }
  updateSync(patch: Data) {
    const c = this.db.col(this.collectionName);
    const prev = c.get(this.id);
    if (!prev) throw new Error(`NOT_FOUND: ${this.collectionName}/${this.id}`);
    c.set(this.id, clone({ ...prev, ...stripUndefined(patch) }));
    this.db.writes++;
  }
  deleteSync() {
    this.db.col(this.collectionName).delete(this.id);
    this.db.writes++;
  }
  async set(data: Data, opts?: { merge?: boolean }) {
    this.setSync(data, opts);
  }
  async update(patch: Data) {
    this.updateSync(patch);
  }
  async delete() {
    this.deleteSync();
  }
}

type Filter = { field: string; value: unknown };

export class FakeQuery {
  constructor(
    protected db: FakeDb,
    public collectionName: string,
    protected filters: Filter[] = [],
    protected order: { field: string; dir: 'asc' | 'desc' } | null = null,
    protected max: number | null = null
  ) {}
  where(field: string, op: string, value: unknown) {
    if (op !== '==') throw new Error(`FakeDb only supports '==' (got ${op})`);
    return new FakeQuery(this.db, this.collectionName, [...this.filters, { field, value }], this.order, this.max);
  }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
    return new FakeQuery(this.db, this.collectionName, this.filters, { field, dir }, this.max);
  }
  limit(n: number) {
    return new FakeQuery(this.db, this.collectionName, this.filters, this.order, n);
  }
  runSync() {
    let rows = Array.from(this.db.col(this.collectionName).entries()).filter(([, d]) =>
      this.filters.every((f) => f.field in d && d[f.field] === f.value)
    );
    if (this.order) {
      const { field, dir } = this.order;
      rows = rows.sort((a, b) => {
        const x = sortValue(a[1][field]);
        const y = sortValue(b[1][field]);
        const c = x < y ? -1 : x > y ? 1 : 0;
        return dir === 'desc' ? -c : c;
      });
    }
    if (this.max !== null) rows = rows.slice(0, this.max);
    const docs = rows.map(([id, d]) => new FakeSnapshot(new FakeDocRef(this.db, this.collectionName, id), d));
    return { docs, empty: docs.length === 0, size: docs.length };
  }
  async get() {
    return this.runSync();
  }
}

export class FakeCollection extends FakeQuery {
  constructor(db: FakeDb, name: string) {
    super(db, name);
  }
  doc(id?: string) {
    return new FakeDocRef(this.db, this.collectionName, id ?? this.db.nextId());
  }
}

export class FakeTransaction {
  private ops: Array<() => void> = [];
  constructor(private db: FakeDb) {}
  async get(target: FakeDocRef | FakeQuery) {
    if (target instanceof FakeDocRef) return target.snapshot();
    return target.runSync();
  }
  async getAll(...refs: FakeDocRef[]) {
    return refs.map((r) => r.snapshot());
  }
  set(ref: FakeDocRef, data: Data, opts?: { merge?: boolean }) {
    this.ops.push(() => ref.setSync(data, opts));
    return this;
  }
  update(ref: FakeDocRef, patch: Data) {
    this.ops.push(() => ref.updateSync(patch));
    return this;
  }
  delete(ref: FakeDocRef) {
    this.ops.push(() => ref.deleteSync());
    return this;
  }
  commit() {
    this.ops.forEach((op) => op());
  }
}

export function createFakeDb() {
  return new FakeDb();
}
