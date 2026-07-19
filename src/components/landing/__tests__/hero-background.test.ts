import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const heroPath = join(process.cwd(), "src", "components", "landing", "hero.tsx");
const imagePath = join(process.cwd(), "public", "landing", "projectops360-network-hero.png");

describe("landing hero composition", () => {
  it("uses the approved network image above the existing animated graph", () => {
    const source = readFileSync(heroPath, "utf8");
    const imagePosition = source.indexOf('src="/landing/projectops360-network-hero.png"');
    const graphPosition = source.indexOf("<AnimatedHeroGraph />");

    expect(source).toContain('import Image from "next/image"');
    expect(imagePosition).toBeGreaterThan(-1);
    expect(graphPosition).toBeGreaterThan(imagePosition);
  });

  it("keeps the approved PNG asset available to the public landing route", () => {
    const signature = readFileSync(imagePath).subarray(0, 8);

    expect(statSync(imagePath).size).toBeGreaterThan(1_000_000);
    expect(Array.from(signature)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
