// ============================================================================
// ProjectOps360° — Project Export — minimal CSV serializer (pure, no deps)
// ============================================================================
// RFC-4180-ish: quote fields containing comma/quote/newline, escape quotes by
// doubling, render null/undefined as empty. Keeps exports dependency-free.
// ============================================================================

export type CsvCell = string | number | boolean | null | undefined;

/** Serialize rows to CSV given an ordered list of column keys. */
export function toCsv<T extends Record<string, CsvCell>>(rows: T[], columns: (keyof T)[]): string {
  const header = columns.map((c) => escapeCell(String(c))).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c])).join(","));
  return [header, ...body].join("\r\n");
}

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
