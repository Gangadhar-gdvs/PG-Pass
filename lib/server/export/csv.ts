import 'server-only';

/**
 * CSV serialization with formula-injection protection (blueprint §14).
 * A cell beginning with = + - @ (or tab/CR) is prefixed with a single quote so
 * spreadsheet apps don't execute it as a formula. Quotes/commas/newlines are
 * escaped per RFC 4180.
 */
function sanitizeCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Neutralize leading formula triggers.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // RFC 4180 quoting when the cell contains comma, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from headers + rows (array of objects or arrays). */
export function toCsv(headers: string[], rows: Array<Record<string, unknown> | unknown[]>): string {
  const headerLine = headers.map(sanitizeCell).join(',');
  const lines = rows.map((row) => {
    const cells = Array.isArray(row) ? row : headers.map((h) => (row as Record<string, unknown>)[h]);
    return cells.map(sanitizeCell).join(',');
  });
  return [headerLine, ...lines].join('\r\n');
}

/** Standard headers for a CSV download response. */
export function csvResponseHeaders(filename: string): Record<string, string> {
  const safe = filename.replace(/[^\w.\-]/g, '_');
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${safe}"`,
    'Cache-Control': 'private, no-store',
  };
}
