// ============================================================================
// ProjectOps360° — printable document filename helper (client-safe)
// ============================================================================
// Browsers use document.title as the default "Save as PDF" filename. We set it
// just before window.print() and restore it afterwards so every exported PDF
// follows the convention:  Pops360-<Name>-<CODE>-<id8>[-<suffix>]
//   e.g.  Pops360-Charter-CHR-68E38F81-V1
// ============================================================================

/** 8-char uppercase hex pulled from a UUID/id (dashes stripped). */
export function shortId(id: string | null | undefined): string {
  return String(id ?? "").replace(/-/g, "").slice(0, 8).toUpperCase() || "00000000";
}

/** Build a canonical document filename. `suffix` adds e.g. "V1" or a date. */
export function docFilename(name: string, code: string, id: string | null | undefined, suffix?: string): string {
  return `Pops360-${name}-${code}-${shortId(id)}${suffix ? `-${suffix}` : ""}`;
}

/** Open the print dialog with a controlled default filename, then restore. */
export function printWithFilename(filename: string): void {
  if (typeof window === "undefined") return;
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const original = document.title;
  document.title = safe;
  const restore = () => { document.title = original; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
}
