import { describe, it, expect } from "vitest";
import { packLanes, type LaneInterval } from "../lane-packing";

let seq = 0;
function iv(startX: number, endX: number, open = false, enterLeft = false): LaneInterval {
  return { id: `b${seq++}`, startX, endX, open, enterLeft };
}

describe("packLanes", () => {
  it("reuses a lane for two branches that don't overlap in time", () => {
    const a = iv(0, 40), b = iv(80, 120);
    const { placed, overflow } = packLanes([a, b], 6);
    expect(overflow).toEqual([]);
    expect(placed.find((p) => p.id === a.id)!.lane).toBe(0);
    expect(placed.find((p) => p.id === b.id)!.lane).toBe(0); // same lane, reused
  });

  it("puts overlapping branches on different lanes", () => {
    const a = iv(0, 100), b = iv(20, 80);
    const { placed } = packLanes([a, b], 6);
    const la = placed.find((p) => p.id === a.id)!.lane;
    const lb = placed.find((p) => p.id === b.id)!.lane;
    expect(la).not.toBe(lb);
  });

  it("short → inner lane, long → outer lane (fewer crossings)", () => {
    const short = iv(30, 45);
    const long = iv(0, 100);
    const { placed } = packLanes([long, short], 6);
    const ls = placed.find((p) => p.id === short.id)!.lane;
    const ll = placed.find((p) => p.id === long.id)!.lane;
    expect(ls).toBeLessThan(ll); // short inner, long outer
  });

  it("overflows the excess when the budget is exceeded", () => {
    // three mutually overlapping intervals, budget 2 → one overflows
    const a = iv(0, 100), b = iv(10, 90), c = iv(20, 80);
    const { placed, overflow } = packLanes([a, b, c], 2);
    expect(placed.length).toBe(2);
    expect(overflow.length).toBe(1);
  });

  it("guarantees an OPEN branch a lane by evicting the longest merged blocker", () => {
    // budget 2, two overlapping merged fill both lanes; an open crossing both
    // must be placed → the LONGER merged is evicted to overflow.
    const m1 = iv(10, 95); // longer merged
    const m2 = iv(20, 70); // shorter merged
    const open = iv(0, 100, true);
    const { placed, overflow } = packLanes([m1, m2, open], 2);
    expect(placed.some((p) => p.id === open.id)).toBe(true); // open is drawn
    expect(overflow.map((o) => o.id)).toEqual([m1.id]); // longest merged evicted
    expect(placed.some((p) => p.id === m2.id)).toBe(true); // shorter merged kept
  });

  it("acceptance: one open covering the domain + 5 short merged inside → open on the outer lane, no crossings", () => {
    const open = iv(0, 100, true); // whole domain
    const shorts = [iv(5, 13), iv(25, 33), iv(45, 53), iv(65, 73), iv(85, 93)]; // sequential, inside
    const { placed, overflow } = packLanes([open, ...shorts], 6);
    expect(overflow).toEqual([]);
    const openLane = placed.find((p) => p.id === open.id)!.lane;
    const shortLanes = shorts.map((s) => placed.find((p) => p.id === s.id)!.lane);
    // every short is inner (closer to master) than the open → open elbows never
    // cross a short segment
    expect(shortLanes.every((l) => l < openLane)).toBe(true);
    expect(new Set(shortLanes).size).toBe(1); // all shorts reuse one inner lane
  });
});
