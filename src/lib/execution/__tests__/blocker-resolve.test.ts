import { describe, it, expect } from "vitest";
import { buildBlockerResolveHref } from "../blocker-resolve";

// ============================================================================
// REG-BLOCKER-RESOLVE-OPENS-TASK — "Resolve now" opens the blocked task,
// it never resolves anything automatically. The target is the existing
// Workboard editor deep-link (?task=<id>) — a plain navigation that cannot hang.
// ============================================================================

describe("buildBlockerResolveHref", () => {
  it("points at the Workboard editor deep-link for the blocked task", () => {
    expect(buildBlockerResolveHref("/en/projects/p1", "t1")).toBe("/en/projects/p1/workboard?task=t1");
    expect(buildBlockerResolveHref("/es/projects/p1", "t1")).toBe("/es/projects/p1/workboard?task=t1");
  });

  it("carries the exact taskId (url-encoded), never a status/action", () => {
    const href = buildBlockerResolveHref("/en/projects/p1", "a b/c");
    expect(href).toBe("/en/projects/p1/workboard?task=a%20b%2Fc");
    // It is a navigation to the task, not a mutation: no status/complete/resolve verbs.
    expect(href).toContain("?task=");
    expect(href).not.toMatch(/status|complete|resolve|done|delete/i);
  });
});
