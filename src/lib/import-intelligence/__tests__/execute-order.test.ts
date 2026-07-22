import { describe, expect, it } from "vitest";
import { orderImportEntities, type SourceOrderedImportEntity } from "../source-order";

interface MilestoneEntity extends SourceOrderedImportEntity {
  sourceId: string;
}

function milestone(sourceId: string, sourceOrder: number): MilestoneEntity {
  return {
    source_order: sourceOrder,
    sourceId,
  };
}

describe("import entity source ordering", () => {
  it("preserves the source milestone order when database rows arrive shuffled", () => {
    const ordered = orderImportEntities([
      milestone("P6", 6),
      milestone("P0", 0),
      milestone("P2", 2),
      milestone("P1", 1),
    ]);

    expect(ordered.map((item) => item.sourceId)).toEqual(["P0", "P1", "P2", "P6"]);
  });

  it("keeps input order for legacy rows without a source ordinal", () => {
    const p0 = milestone("P0", 0);
    const p1 = milestone("P1", 1);
    p0.source_order = null;
    p1.source_order = null;

    const ordered = orderImportEntities([p1, p0]);

    expect(ordered.map((item) => item.sourceId)).toEqual(["P1", "P0"]);
  });
});
