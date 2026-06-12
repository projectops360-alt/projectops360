import { describe, it, expect } from "vitest";
import { buildVersionDelta, snapshotFromFile, type VersionSnapshot } from "../version-sync";

const base: VersionSnapshot = {
  revision: "2",
  totalPages: 10,
  noteTexts: ["VERIFY ALL DIMENSIONS.", "SUBMIT SHOP DRAWINGS."],
};

describe("buildVersionDelta", () => {
  it("detects revision change, page delta and new notes", () => {
    const delta = buildVersionDelta(base, {
      revision: "3",
      totalPages: 12,
      noteTexts: ["VERIFY ALL DIMENSIONS.", "SUBMIT SHOP DRAWINGS.", "NEW FIRE RATING REQUIRED AT CORRIDOR."],
    });
    expect(delta.changed).toBe(true);
    expect(delta.revisionChanged).toBe(true);
    expect(delta.pageCountDelta).toBe(2);
    expect(delta.newNotes).toEqual(["NEW FIRE RATING REQUIRED AT CORRIDOR."]);
    expect(delta.removedNotes).toEqual([]);
    expect(delta.summary).toContain("revision 2 → 3");
    expect(delta.summary).toContain("+2 page(s)");
    expect(delta.summary).toContain("1 new note(s)");
  });

  it("detects removed notes case-insensitively", () => {
    const delta = buildVersionDelta(base, {
      revision: "2",
      totalPages: 10,
      noteTexts: ["verify all dimensions."],
    });
    expect(delta.revisionChanged).toBe(false);
    expect(delta.removedNotes).toEqual(["SUBMIT SHOP DRAWINGS."]);
  });

  it("reports no changes for identical snapshots", () => {
    const delta = buildVersionDelta(base, { ...base });
    expect(delta.changed).toBe(false);
    expect(delta.summary).toContain("no metadata-level changes");
  });

  it("handles missing page counts without inventing a delta", () => {
    const delta = buildVersionDelta({ ...base, totalPages: null }, { ...base, revision: "3" });
    expect(delta.pageCountDelta).toBeNull();
    expect(delta.revisionChanged).toBe(true);
  });
});

describe("snapshotFromFile", () => {
  it("extracts note texts and page count from canonical metadata", () => {
    const snapshot = snapshotFromFile({
      revision: "3",
      metadata: {
        total_pages: 4,
        canonical_extraction: {
          pages: [
            { notes: [{ text: "NOTE ONE" }, { text: "NOTE TWO" }] },
            { notes: [] },
          ],
        },
      },
    });
    expect(snapshot).toEqual({ revision: "3", totalPages: 4, noteTexts: ["NOTE ONE", "NOTE TWO"] });
  });

  it("degrades to empty snapshot without canonical metadata", () => {
    const snapshot = snapshotFromFile({ revision: null, metadata: {} });
    expect(snapshot).toEqual({ revision: null, totalPages: null, noteTexts: [] });
  });
});
