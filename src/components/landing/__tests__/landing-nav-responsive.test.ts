import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("landing navigation responsive contract", () => {
  it("keeps the mobile header within the viewport", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/landing/nav.tsx"),
      "utf8",
    );

    expect(source).toContain('LogoStage className="h-12 sm:h-16');
    expect(source).toContain("sm:inline-flex");
    expect(source).toContain("px-4 py-5");
  });
});
