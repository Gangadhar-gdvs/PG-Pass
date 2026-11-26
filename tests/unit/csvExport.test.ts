import { describe, it, expect } from 'vitest';
import { toCsv } from '@/lib/server/export/csv';

/**
 * CSV export must neutralize spreadsheet formula injection (blueprint §14):
 * cells starting with = + - @ (or tab/CR) are prefixed with a single quote, and
 * commas/quotes/newlines are RFC-4180 quoted. Guards the owner-facing exports.
 */
describe('toCsv — formula injection + RFC-4180 escaping', () => {
  it('prefixes formula-trigger cells with a quote', () => {
    const csv = toCsv(['A'], [['=SUM(A1:A2)'], ['+1+1'], ['-2'], ['@cmd']]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe("'=SUM(A1:A2)");
    expect(lines[2]).toBe("'+1+1");
    expect(lines[3]).toBe("'-2");
    expect(lines[4]).toBe("'@cmd");
  });

  it('quotes cells containing commas, quotes, or newlines', () => {
    const csv = toCsv(['A'], [['a,b'], ['she said "hi"'], ['line1\nline2']]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('"a,b"');
    expect(lines[2]).toBe('"she said ""hi"""');
    // the embedded newline stays inside the quoted cell
    expect(csv).toContain('"line1\nline2"');
  });

  it('leaves safe cells untouched and handles null/undefined', () => {
    const csv = toCsv(['Name', 'Amt'], [{ Name: 'Rahul', Amt: 5000 }, { Name: null, Amt: undefined }]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Name,Amt');
    expect(lines[1]).toBe('Rahul,5000');
    expect(lines[2]).toBe(',');
  });

  it('accepts both object rows (keyed by header) and array rows', () => {
    const fromObj = toCsv(['x', 'y'], [{ x: 1, y: 2 }]);
    const fromArr = toCsv(['x', 'y'], [[1, 2]]);
    expect(fromObj).toBe(fromArr);
  });
});
