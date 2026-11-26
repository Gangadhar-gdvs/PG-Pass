import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
  type TokenOptions,
} from '@firebase/rules-unit-testing';
import { ALL_STAFF_PERMISSIONS, type StaffPermission } from '@/lib/constants/permissions';

// RULES_FILE lets you point the suite at a candidate/mutated rules file
// (e.g. to confirm a deliberately broken rule makes the suite go red).
export const RULES_PATH = process.env.RULES_FILE
  ? path.resolve(process.env.RULES_FILE)
  : path.resolve(__dirname, '../../firestore.rules');
export const loadRules = () => readFileSync(RULES_PATH, 'utf8');

export const OWNER_A = 'ownerA';
export const OWNER_B = 'ownerB';

const staffClaims = (ownerId: string) => ({ role: 'staff', ownerId, suspended: false });

/**
 * Every identity the rules distinguish. Claims mirror what the server actually
 * mints (staff.service.ts → {role:'staff', ownerId, suspended:false};
 * residents.service.ts → {role:'resident'}; admin → {admin:true}).
 * Staff access ALSO depends on the live staff/{uid} doc — see STAFF_DOCS.
 * `null` = signed out.
 */
export const PERSONAS = {
  ownerA: { uid: OWNER_A, claims: {} },
  ownerB: { uid: OWNER_B, claims: {} },
  staffA: { uid: 'staffA', claims: staffClaims(OWNER_A) }, // active, every permission
  staffB: { uid: 'staffB', claims: staffClaims(OWNER_B) }, // active, every permission (owner B)
  staffANoPerms: { uid: 'staffA-none', claims: staffClaims(OWNER_A) }, // active, permissions: []
  admin: { uid: 'adminU', claims: { admin: true } },
  resident: { uid: 'residentR', claims: { role: 'resident' } },
  // Negative variants — each must be treated as "no access".
  suspendedOwnerA: { uid: OWNER_A, claims: { suspended: true } },
  suspendedStaffA: { uid: 'staffA', claims: { role: 'staff', ownerId: OWNER_A, suspended: true } },
  // Valid, unexpired staff claims, but the staff doc says otherwise (R-S5: no
  // waiting for the ID token to refresh).
  revokedStaffA: { uid: 'staffA-revoked', claims: staffClaims(OWNER_A) },
  docSuspendedStaffA: { uid: 'staffA-suspended', claims: staffClaims(OWNER_A) },
  staffAMovedToB: { uid: 'staffA-moved', claims: staffClaims(OWNER_A) }, // doc.ownerId = ownerB
  staffANoDoc: { uid: 'staffA-nodoc', claims: staffClaims(OWNER_A) }, // claims only, doc deleted
  suspendedAdmin: { uid: 'adminU', claims: { admin: true, suspended: true } },
  staffNoOwnerClaim: { uid: 'staffX', claims: { role: 'staff' } },
  residentWithOwnerClaim: { uid: 'residentR', claims: { role: 'resident', ownerId: OWNER_A } },
  adminClaimFalse: { uid: 'notAdmin', claims: { admin: false } },
  anon: null,
} as const satisfies Record<string, { uid: string; claims: TokenOptions } | null>;

export type PersonaKey = keyof typeof PERSONAS;

/** Persona keys whose staff access must be denied everywhere despite staff claims. */
export const BROKEN_STAFF: PersonaKey[] = [
  'suspendedStaffA',
  'revokedStaffA',
  'docSuspendedStaffA',
  'staffAMovedToB',
  'staffANoDoc',
  'staffNoOwnerClaim',
];

/** uid of a staff member of owner A holding exactly one permission. */
export const singlePermStaffUid = (perm: StaffPermission) => `staffA-only-${perm}`;

const staffDoc = (ownerId: string, permissions: readonly string[], accountStatus = 'active') => ({
  ownerId,
  name: 'Warden',
  role: 'warden',
  accountStatus,
  permissions: [...permissions],
});

/** staff/{uid} docs as staff.service writes them (seed into every rules project). */
export const STAFF_DOCS: Record<string, Record<string, unknown>> = {
  staffA: staffDoc(OWNER_A, ALL_STAFF_PERMISSIONS),
  staffB: staffDoc(OWNER_B, ALL_STAFF_PERMISSIONS),
  'staffA-none': staffDoc(OWNER_A, []),
  'staffA-revoked': staffDoc(OWNER_A, ALL_STAFF_PERMISSIONS, 'revoked'),
  'staffA-suspended': staffDoc(OWNER_A, ALL_STAFF_PERMISSIONS, 'suspended'),
  'staffA-moved': staffDoc(OWNER_B, ALL_STAFF_PERMISSIONS),
  ...Object.fromEntries(ALL_STAFF_PERMISSIONS.map((p) => [singlePermStaffUid(p), staffDoc(OWNER_A, [p])])),
};

export const seedStaffDocs = (env: RulesTestEnvironment) =>
  seed(env, Object.fromEntries(Object.entries(STAFF_DOCS).map(([uid, d]) => [`staff/${uid}`, d])));

export function ctx(env: RulesTestEnvironment, who: PersonaKey): RulesTestContext {
  const p = PERSONAS[who];
  return p ? env.authenticatedContext(p.uid, p.claims) : env.unauthenticatedContext();
}

/** Firestore for a staff member of owner A who holds exactly `perm`. */
export const singlePermStaffDb = (env: RulesTestEnvironment, perm: StaffPermission) =>
  env.authenticatedContext(singlePermStaffUid(perm), staffClaims(OWNER_A)).firestore();

export const db = (env: RulesTestEnvironment, who: PersonaKey) => ctx(env, who).firestore();

/**
 * Starts a rules-test environment against the emulator in FIRESTORE_EMULATOR_HOST
 * (set automatically by `firebase emulators:exec`), defaulting to the local dev
 * emulator on 127.0.0.1:8080. Each suite passes its own `demo-rules-*` project id
 * so suites are isolated from each other and from the app's `demo-pgpass` data.
 */
export async function startEnv(projectId: string): Promise<RulesTestEnvironment> {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const idx = hostPort.lastIndexOf(':');
  const env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: loadRules(),
      host: hostPort.slice(0, idx),
      port: Number(hostPort.slice(idx + 1)),
    },
  });
  await env.clearFirestore();
  await seedStaffDocs(env);
  return env;
}

/** Seed documents bypassing rules (the Admin-SDK equivalent). */
export async function seed(
  env: RulesTestEnvironment,
  docs: Record<string, Record<string, unknown>>
): Promise<void> {
  await env.withSecurityRulesDisabled(async (c) => {
    const fs = c.firestore();
    await Promise.all(Object.entries(docs).map(([p, data]) => fs.doc(p).set(data)));
  });
}

/**
 * Extracts every `match` path from firestore.rules (comments stripped, nested
 * blocks resolved), relative to `/databases/{database}/documents`, as collection
 * patterns: `/beds/{bedId}` → `beds`; `/support_threads/{ownerId}/messages/{msgId}`
 * → `support_threads/*\/messages`; `/{document=**}` → `**`.
 */
export function parseRuleCollections(source: string): string[] {
  const noComments = source.replace(/\/\/[^\n]*/g, '');
  const paths: string[] = [];
  const stack: (string | null)[] = [];
  const tokenRe = /match\s+(\/[^\s{]*(?:\{[^}]*\}[^\s{]*)*)\s*\{|\{|\}/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(noComments))) {
    if (m[1] !== undefined) {
      const parent = stack.filter((s): s is string => s !== null).join('');
      const full = parent + m[1];
      stack.push(m[1]);
      paths.push(full);
    } else if (m[0] === '{') {
      stack.push(null);
    } else {
      stack.pop();
    }
  }
  const ROOT = '/databases/{database}/documents';
  return paths
    .filter((p) => p.startsWith(ROOT) && p !== ROOT)
    .map((p) => p.slice(ROOT.length + 1))
    .map((p) => {
      if (p.includes('=**')) return '**';
      const segs = p.split('/');
      return segs
        .filter((_, i) => i % 2 === 0)
        .join('/*/');
    });
}

/** Concrete collection path for a pattern (fills `*` with ownerA). */
export const concrete = (pattern: string) => pattern.replace(/\*/g, OWNER_A);
