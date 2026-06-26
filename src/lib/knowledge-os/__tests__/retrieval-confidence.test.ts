import { describe, it, expect } from "vitest";
import { fuseRrf } from "../retrieval";
import { computeConfidence, pickAnswerTier } from "../confidence";
import type { RetrievedChunk } from "../types";

function chunk(id: string, partial: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: id,
    packageId: `pkg-${id}`,
    versionId: `ver-${id}`,
    slug: `slug-${id}`,
    language: "en",
    title: `Title ${id}`,
    body: `Body ${id}`,
    confidenceTier: "verified",
    fused: 0,
    ...partial,
  };
}

describe("fuseRrf", () => {
  it("merges vector + lexical signals onto one record per chunk", () => {
    const vector = [chunk("a", { similarity: 0.9 }), chunk("b", { similarity: 0.8 })];
    const lexical = [chunk("b", { lexRank: 0.5 }), chunk("c", { lexRank: 0.4 })];
    const fused = fuseRrf(vector, lexical);

    expect(fused).toHaveLength(3);
    const b = fused.find((c) => c.chunkId === "b")!;
    // 'b' appears in both lists → carries both signals and ranks first.
    expect(b.similarity).toBe(0.8);
    expect(b.lexRank).toBe(0.5);
    expect(fused[0].chunkId).toBe("b");
  });

  it("ranks a chunk found by both retrievers above single-list chunks", () => {
    const both = chunk("x", { similarity: 0.7 });
    const onlyVec = chunk("y", { similarity: 0.95 });
    const fused = fuseRrf([onlyVec, both], [both]);
    expect(fused[0].chunkId).toBe("x");
  });

  it("returns empty for empty inputs", () => {
    expect(fuseRrf([], [])).toEqual([]);
  });
});

describe("pickAnswerTier", () => {
  it("uses the primary (top-ranked) source tier", () => {
    expect(pickAnswerTier([chunk("a", { confidenceTier: "best_practice" }), chunk("b")])).toBe("best_practice");
  });
  it("defaults to ai_suggestion with no sources", () => {
    expect(pickAnswerTier([])).toBe("ai_suggestion");
  });
});

describe("computeConfidence", () => {
  it("never returns Verified when not grounded", () => {
    const r = computeConfidence({ grounded: false, usedChunks: [chunk("a")], hadVectorConfirmation: true });
    expect(r.tier).toBe("ai_suggestion");
    expect(r.score).toBeLessThan(0.3);
  });

  it("scores a vector-confirmed verified answer highly", () => {
    const r = computeConfidence({
      grounded: true,
      usedChunks: [chunk("a", { similarity: 0.9 }), chunk("b", { similarity: 0.8 })],
      hadVectorConfirmation: true,
    });
    expect(r.tier).toBe("verified");
    expect(r.score).toBeGreaterThan(0.8);
  });

  it("caps a lexical-only answer below a vector-confirmed one", () => {
    const lexical = computeConfidence({
      grounded: true,
      usedChunks: [chunk("a")],
      hadVectorConfirmation: false,
    });
    const vector = computeConfidence({
      grounded: true,
      usedChunks: [chunk("a", { similarity: 0.9 })],
      hadVectorConfirmation: true,
    });
    expect(lexical.score).toBeLessThan(vector.score);
  });

  it("carries a lower-tier primary source into the answer tier", () => {
    const r = computeConfidence({
      grounded: true,
      usedChunks: [chunk("a", { confidenceTier: "best_practice", similarity: 0.85 })],
      hadVectorConfirmation: true,
    });
    expect(r.tier).toBe("best_practice");
    expect(r.score).toBeLessThan(1);
  });
});
