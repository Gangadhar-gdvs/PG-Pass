import { describe, expect, it } from 'vitest';
import { ALL_CLASSIFIED } from './collections';
import { loadRules, parseRuleCollections } from './helpers';

/**
 * Guard: every `match` in firestore.rules must be classified in collections.ts
 * (and therefore exercised by the rules suite). A new collection added to the
 * rules without tests fails here with its name.
 */
describe('rules coverage', () => {
  const inRules = parseRuleCollections(loadRules());

  it('parses the match blocks', () => {
    expect(inRules).toContain('beds');
    expect(inRules).toContain('support_threads/*/messages');
    expect(inRules).toContain('**');
  });

  it('every collection in firestore.rules is classified in tests/rules/collections.ts', () => {
    const unclassified = inRules.filter((c) => !ALL_CLASSIFIED.includes(c));
    expect(unclassified, 'add these to tests/rules/collections.ts').toEqual([]);
  });

  it('no classified collection is missing from firestore.rules (stale entries)', () => {
    const stale = ALL_CLASSIFIED.filter((c) => !inRules.includes(c));
    expect(stale, 'remove these from tests/rules/collections.ts or restore the rule').toEqual([]);
  });

  it('each collection has exactly one match block', () => {
    const dupes = inRules.filter((c, i) => inRules.indexOf(c) !== i);
    expect(dupes).toEqual([]);
  });
});
