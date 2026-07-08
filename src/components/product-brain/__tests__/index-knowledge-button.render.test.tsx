// ============================================================================
// Product Brain Control Center — "Index knowledge" button (UI render guard)
// ============================================================================
// The indexLivingGuideAction (owner/admin, server-enforced) is now wired to a
// visible cockpit button. Guards: button renders bilingually (EN/ES, UX-012 —
// never Spanglish), and the pure result formatter reports processed/embedded/
// failed, the nothing-pending case, and errors in the right language. The
// server action module is mocked so this node-env SSR test never touches
// env/admin clients.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/living-guide/actions", () => ({
  indexLivingGuideAction: vi.fn(),
}));

import { IndexKnowledgeButton, formatIndexKnowledgeResult } from "../index-knowledge-button";

describe("IndexKnowledgeButton render (EN/ES, UX-012)", () => {
  it("renders the English label", () => {
    const html = renderToStaticMarkup(<IndexKnowledgeButton es={false} />);
    expect(html).toContain("Index knowledge");
    expect(html).not.toContain("Indexar conocimiento");
  });
  it("renders the Spanish label (no Spanglish)", () => {
    const html = renderToStaticMarkup(<IndexKnowledgeButton es={true} />);
    expect(html).toContain("Indexar conocimiento");
    expect(html).not.toContain("Index knowledge");
  });
});

describe("formatIndexKnowledgeResult (pure)", () => {
  it("reports processed/embedded/failed in each language", () => {
    const res = { ok: true, processed: 28, embedded: 27, failed: 1 };
    expect(formatIndexKnowledgeResult(res, false)).toBe("Processed: 28 · Embedded: 27 · Failed: 1");
    expect(formatIndexKnowledgeResult(res, true)).toBe("Procesados: 28 · Indexados: 27 · Fallidos: 1");
  });
  it("reports the nothing-pending case honestly", () => {
    const res = { ok: true, processed: 0, embedded: 0, failed: 0 };
    expect(formatIndexKnowledgeResult(res, false)).toMatch(/Nothing pending/);
    expect(formatIndexKnowledgeResult(res, true)).toMatch(/Nada pendiente/);
  });
  it("surfaces the server message on failure (e.g. Not authorized), with a bilingual fallback", () => {
    expect(formatIndexKnowledgeResult({ ok: false, message: "Not authorized" }, false)).toBe("Not authorized");
    expect(formatIndexKnowledgeResult({ ok: false }, false)).toBe("Could not index knowledge.");
    expect(formatIndexKnowledgeResult({ ok: false }, true)).toBe("No se pudo indexar el conocimiento.");
  });
});
